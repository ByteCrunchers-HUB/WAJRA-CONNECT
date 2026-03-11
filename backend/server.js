const express = require("express");
const cors = require("cors");
const twilio = require("twilio");
const bodyParser = require("body-parser");
const { spawn } = require("child_process");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
require("dotenv").config();

// Multer Setup for Camera Images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, 'latest.jpg');
  }
});
const upload = multer({ storage: storage });

const PYTHON_EXEC = process.env.PYTHON_EXEC || "python";
const DEVICE_API_KEY = process.env.DEVICE_API_KEY || "WajraConnect-device-key";
const RISK_ALERT_THRESHOLD = Number(process.env.RISK_ALERT_THRESHOLD || 0.72);

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER;
let twilioClient = null;
if (TWILIO_SID && TWILIO_TOKEN) {
  twilioClient = twilio(TWILIO_SID, TWILIO_TOKEN);
}

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, "..")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "index.html"));
});

// In-Memory State (Will eventually be pushed to Firestore)
let latestSensorData = {
  heartRate: 75,
  hrv: 40,
  motionX: 0,
  motionY: 0,
  motionZ: 0,
  timestamp: Date.now(),
};
let latestPrediction = {
  emotion: "Unknown",
  confidence: 0,
  riskScore: 0,
};

function validateSensorPayload(payload) {
  const required = ["heartRate", "hrv", "motionX", "motionY", "motionZ"];
  for (const key of required) {
    if (payload[key] === undefined || payload[key] === null || Number.isNaN(Number(payload[key]))) {
      return `Invalid field: ${key}`;
    }
  }
  return null;
}

function runMlInference(data) {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn(PYTHON_EXEC, [
      path.join(__dirname, "ml", "infer.py"),
      String(data.heartRate),
      String(data.hrv),
      String(data.motionX),
      String(data.motionY),
      String(data.motionZ),
    ]);

    let stdout = "";
    let stderr = "";
    pythonProcess.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    pythonProcess.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    pythonProcess.on("error", (err) => reject(err));
    pythonProcess.on("close", (code) => {
      if (code !== 0) return reject(new Error(stderr || `ML process exited with code ${code}`));
      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed.error) return reject(new Error(parsed.error));
        return resolve(parsed);
      } catch { return reject(new Error(`Invalid ML output: ${stdout}`)); }
    });
  });
}

async function triggerAlert(prediction, data) {
  console.log(`[ALERT] ${prediction.emotion} detected! Risk: ${prediction.riskScore}`);

  // Twilio Logic remains active for backend alerting
  if (!twilioClient || !TWILIO_FROM) return;
  const contacts = process.env.EMERGENCY_CONTACTS ? process.env.EMERGENCY_CONTACTS.split(",") : [];
  if (contacts.length === 0) return;

  const msg = `WajraConnect ALERT: ${prediction.emotion} risk=${prediction.riskScore}. Location ${data.lat || 0},${data.lng || 0}`;
  for (const number of contacts) {
    try {
      await twilioClient.messages.create({
        body: msg,
        from: TWILIO_FROM,
        to: number.trim(),
      });
      console.log(`SMS sent to ${number}`);
    } catch (err) {
      console.error(`Twilio SMS error for ${number}:`, err.message);
    }
  }
}

async function processSensorEvent(sensorPayload, options = {}) {
  latestSensorData = {
    heartRate: Number(sensorPayload.heartRate),
    hrv: Number(sensorPayload.hrv),
    motionX: Number(sensorPayload.motionX),
    motionY: Number(sensorPayload.motionY),
    motionZ: Number(sensorPayload.motionZ),
    lat: sensorPayload.lat !== undefined ? Number(sensorPayload.lat) : undefined,
    lng: sensorPayload.lng !== undefined ? Number(sensorPayload.lng) : undefined,
    battery: sensorPayload.battery !== undefined ? Number(sensorPayload.battery) : undefined,
    timestamp: Date.now(),
  };

  const prediction = await runMlInference(latestSensorData);
  latestPrediction = prediction;

  const shouldAlert = prediction.emotion === "Panic" || Number(prediction.riskScore) >= RISK_ALERT_THRESHOLD;
  if (shouldAlert) {
    await triggerAlert(prediction, latestSensorData);
  }

  return prediction;
}

// IoT Routes
app.post("/api/iot/ingest", async (req, res) => {
  const apiKey = req.headers["x-device-key"];
  if (!apiKey || apiKey !== DEVICE_API_KEY) return res.status(401).json({ error: "Invalid device key" });

  const validationError = validateSensorPayload(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    const prediction = await processSensorEvent(req.body, { source: "iot" });
    res.json({ status: "accepted", prediction });
  } catch (err) { res.status(500).json({ error: "IoT ingest failed", details: err.message }); }
});

app.post("/api/iot/location", async (req, res) => {
  const apiKey = req.headers["x-device-key"];
  if (!apiKey || apiKey !== DEVICE_API_KEY) return res.status(401).json({ error: "Invalid device key" });

  const { lat, lng, sos, battery } = req.body;
  if (lat !== undefined) latestSensorData.lat = lat;
  if (lng !== undefined) latestSensorData.lng = lng;
  if (battery !== undefined) latestSensorData.battery = battery;
  latestSensorData.timestamp = Date.now();

  if (sos) {
    latestPrediction = { emotion: "Panic", riskScore: 1.0, confidence: 1.0 };
    await triggerAlert(latestPrediction, latestSensorData);
  }
  res.json({ status: "success" });
});

app.post("/api/camera", upload.single("image"), (req, res) => {
  res.json({ status: "ok", filename: req.file ? req.file.filename : null });
});

app.get("/api/status", (_req, res) => {
  res.json({ latestData: latestSensorData, latestPrediction, systemStatus: "Operational" });
});

app.get("/api/ml/model-info", async (_req, res) => {
  const pythonProcess = spawn(PYTHON_EXEC, [path.join(__dirname, "ml", "infer.py"), "--model-info"]);
  let stdout = "";
  pythonProcess.stdout.on("data", (d) => { stdout += d.toString(); });
  pythonProcess.on("close", (code) => {
    try { res.json(JSON.parse(stdout.trim())); } catch { res.status(500).json({ error: "Unable to fetch model info" }); }
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`WajraConnect Backend (Firebase-Dependent Ready) running on port ${PORT}`);
});
