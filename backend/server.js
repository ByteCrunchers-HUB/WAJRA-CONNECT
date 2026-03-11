const express = require("express");
const cors = require("cors");
const twilio = require("twilio");
const bodyParser = require("body-parser");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { spawn } = require("child_process");
const path = require("path");
require("dotenv").config();

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "WajraConnect_secret";
const SALT_ROUNDS = 10;
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

// Serve static frontend files from parent directory
app.use(express.static(path.join(__dirname, "..")));

// Default route to index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "index.html"));
});

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

function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "No token provided" });
  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Malformed token" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

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
    pythonProcess.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    pythonProcess.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    pythonProcess.on("error", (err) => reject(err));
    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(stderr || `ML process exited with code ${code}`));
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed.error) return reject(new Error(parsed.error));
        return resolve(parsed);
      } catch {
        return reject(new Error(`Invalid ML output: ${stdout}`));
      }
    });
  });
}

async function triggerAlert(prediction, data, userId = null) {
  const alertData = {
    type: "EMOTION_TRIGGERED",
    emotion: prediction.emotion,
    lat: Number(data.lat ?? 0),
    lng: Number(data.lng ?? 0),
    data: JSON.stringify({
      source: data.source || "iot",
      deviceId: data.deviceId || null,
      sensor: {
        heartRate: data.heartRate,
        hrv: data.hrv,
        motionX: data.motionX,
        motionY: data.motionY,
        motionZ: data.motionZ,
      },
      prediction,
      battery: data.battery ?? null,
      timestamp: data.timestamp || Date.now(),
    }),
    userId: userId || undefined,
  };

  try {
    const created = await prisma.alert.create({ data: alertData });
    console.log(`Alert stored: ${created.id}`);
  } catch (err) {
    console.error("Error storing alert:", err.message);
  }

  if (!twilioClient || !TWILIO_FROM) {
    return;
  }
  const contacts = process.env.EMERGENCY_CONTACTS ? process.env.EMERGENCY_CONTACTS.split(",") : [];
  if (contacts.length === 0) {
    return;
  }
  const msg = `WajraConnect ALERT: ${prediction.emotion} risk=${prediction.riskScore}. Location ${alertData.lat},${alertData.lng}`;
  for (const number of contacts) {
    try {
      const result = await twilioClient.messages.create({
        body: msg,
        from: TWILIO_FROM,
        to: number.trim(),
      });
      console.log(`SMS sent to ${number}: ${result.sid}`);
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
    deviceId: sensorPayload.deviceId || null,
    battery: sensorPayload.battery !== undefined ? Number(sensorPayload.battery) : undefined,
    source: options.source || "web",
    timestamp: sensorPayload.timestamp || Date.now(),
  };

  const prediction = await runMlInference(latestSensorData);
  latestPrediction = prediction;

  const shouldAlert =
    prediction.emotion === "Fear" ||
    prediction.emotion === "Panic" ||
    Number(prediction.riskScore) >= RISK_ALERT_THRESHOLD;

  if (shouldAlert) {
    await triggerAlert(prediction, latestSensorData, options.userId || null);
  }

  return prediction;
}

app.post("/api/auth/signup", async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        uid: `user_${Date.now()}`,
        name: name || "",
        email,
        passwordHash,
      },
    });
    await prisma.user.update({ where: { id: user.id }, data: { uid: user.id } });

    const token = jwt.sign({ userId: user.id, uid: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) return res.status(401).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ userId: user.id, uid: user.uid, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { settings: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    const { passwordHash, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/sensor-data", async (req, res) => {
  const validationError = validateSensorPayload(req.body);
  if (validationError) return res.status(400).json({ error: validationError });
  try {
    const prediction = await processSensorEvent(req.body, { source: "web" });
    res.status(200).json({ status: "success", received: latestSensorData, prediction });
  } catch (err) {
    console.error("ML prediction error:", err.message);
    res.status(500).json({ error: "ML inference failed", details: err.message });
  }
});

app.post("/api/iot/ingest", async (req, res) => {
  const apiKey = req.headers["x-device-key"];
  if (!apiKey || apiKey !== DEVICE_API_KEY) {
    return res.status(401).json({ error: "Invalid device key" });
  }

  const validationError = validateSensorPayload(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  let userId = null;
  if (req.body.userUid) {
    const user = await prisma.user.findUnique({ where: { uid: String(req.body.userUid) } });
    if (user) userId = user.id;
  }

  try {
    const prediction = await processSensorEvent(req.body, {
      source: "iot",
      userId,
    });
    res.status(200).json({
      status: "accepted",
      deviceId: req.body.deviceId || null,
      prediction,
      action: prediction.riskScore >= RISK_ALERT_THRESHOLD ? "alert-evaluated" : "monitoring",
    });
  } catch (err) {
    console.error("IoT ingest error:", err.message);
    res.status(500).json({ error: "IoT ingest failed", details: err.message });
  }
});

app.get("/api/ml/model-info", async (_req, res) => {
  const pythonProcess = spawn(PYTHON_EXEC, [path.join(__dirname, "ml", "infer.py"), "--model-info"]);
  let stdout = "";
  let stderr = "";

  pythonProcess.stdout.on("data", (d) => {
    stdout += d.toString();
  });
  pythonProcess.stderr.on("data", (d) => {
    stderr += d.toString();
  });
  pythonProcess.on("close", (code) => {
    if (code !== 0) {
      return res.status(500).json({ error: "Unable to fetch model info", details: stderr });
    }
    try {
      const parsed = JSON.parse(stdout.trim());
      return res.json(parsed);
    } catch {
      return res.status(500).json({ error: "Invalid model info output", details: stdout });
    }
  });
});

app.get("/api/status", (_req, res) => {
  res.json({
    latestData: latestSensorData,
    latestPrediction,
    systemStatus: "Operational",
  });
});

app.get("/api/user/:uid", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { uid: req.params.uid },
      include: { settings: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    const { passwordHash, ...safeUser } = user;
    res.json({ profile: safeUser });
  } catch (err) {
    console.error("Error fetching user profile:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/user/:uid", requireAuth, async (req, res) => {
  const { name, email, contacts } = req.body;
  try {
    const user = await prisma.user.upsert({
      where: { uid: req.params.uid },
      update: {
        name,
        email,
        contacts: Array.isArray(contacts) ? contacts.join(",") : contacts,
      },
      create: {
        uid: req.params.uid,
        name: name || "",
        email: email || "",
        contacts: Array.isArray(contacts) ? contacts.join(",") : contacts,
      },
    });
    const { passwordHash, ...safeUser } = user;
    res.json({ status: "success", user: safeUser });
  } catch (err) {
    console.error("Error updating profile:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/user/:uid/alerts", requireAuth, async (req, res) => {
  try {
    const alerts = await prisma.alert.findMany({
      where: { user: { uid: req.params.uid } },
      orderBy: { timestamp: "desc" },
    });
    res.json({ alerts });
  } catch (err) {
    console.error("Error fetching alerts:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/user/:uid/settings", requireAuth, async (req, res) => {
  try {
    let settings = await prisma.setting.findFirst({
      where: { user: { uid: req.params.uid } },
    });
    if (!settings) {
      const user = await prisma.user.findUnique({ where: { uid: req.params.uid } });
      if (user) {
        settings = await prisma.setting.create({ data: { userId: user.id } });
      }
    }
    res.json({ settings });
  } catch (err) {
    console.error("Error fetching settings:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/user/:uid/settings", requireAuth, async (req, res) => {
  const updateData = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { uid: req.params.uid } });
    if (!user) return res.status(404).json({ error: "User not found" });
    const settings = await prisma.setting.upsert({
      where: { userId: user.id },
      update: updateData,
      create: { ...updateData, userId: user.id },
    });
    res.json({ status: "success", settings });
  } catch (err) {
    console.error("Error updating settings:", err);
    res.status(500).json({ error: "Server error" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`WajraConnect Backend running on port ${PORT}`);
});
