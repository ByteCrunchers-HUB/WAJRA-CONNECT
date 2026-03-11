const axios = require('axios');

const BACKEND_URL = "http://localhost:5000/api/iot/ingest";
const DEVICE_KEY = process.env.DEVICE_API_KEY || "WajraConnect-device-key";
const USER_UID = process.env.MOCK_USER_UID || "";
const DEVICE_ID = process.env.MOCK_DEVICE_ID || "esp32-sim-01";

/**
 * Simulates an ESP32 wearable sending data at intervals.
 */
function sendSensorData() {
    // Simulate some baseline data
    const hr = 70 + Math.random() * 50; // Random HR between 70 and 120
    const hrv = 20 + Math.random() * 40; // Random HRV between 20 and 60
    const mx = (Math.random() - 0.5) * 4;
    const my = (Math.random() - 0.5) * 4;
    const mz = (Math.random() - 0.5) * 4;

    const payload = {
        deviceId: DEVICE_ID,
        userUid: USER_UID || undefined,
        heartRate: parseFloat(hr.toFixed(2)),
        hrv: parseFloat(hrv.toFixed(2)),
        motionX: parseFloat(mx.toFixed(2)),
        motionY: parseFloat(my.toFixed(2)),
        motionZ: parseFloat(mz.toFixed(2)),
        lat: 12.9716,
        lng: 77.5946,
        battery: parseFloat((30 + Math.random() * 70).toFixed(1)),
        timestamp: Date.now()
    };

    console.log(`[ESP32 Sim] Sending data: HR=${payload.heartRate} BPM, HRV=${payload.hrv}ms`);

    axios.post(BACKEND_URL, payload, {
        headers: {
            "x-device-key": DEVICE_KEY
        }
    })
        .then(res => console.log(`[ESP32 Sim] Server Response: ${res.data.status}, emotion=${res.data.prediction?.emotion}, risk=${res.data.prediction?.riskScore}`))
        .catch(err => console.error(`[ESP32 Sim] Error: ${err.message}`));
}

// Start simulation every 5 seconds
console.log("ESP32 Wearable Simulation Started...");
setInterval(sendSensorData, 5000);
