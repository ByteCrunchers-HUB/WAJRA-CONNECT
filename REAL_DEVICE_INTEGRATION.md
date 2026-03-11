# Real Device Integration Guide for WAJRAWEAR (Mark 2 & Camera)

> **Purpose** – This guide explains how to connect a physical **Mark 2** WAJRAWEAR prototype (ESP32‑based) equipped with a **camera module** to the backend we built, and how to enable real‑time emotion detection and alert processing.

---

## 📦 Prerequisites

| Item | Minimum version / notes |
|------|------------------------|
| **ESP32‑C3 / ESP32‑S2** (Mark 2 board) | Flashable via Arduino IDE or PlatformIO |
| **Camera** (e.g., OV2640, compatible with ESP32) | Connected to the ESP32’s dedicated pins (see wiring table) |
| **Sensors** – Pulse (PPG) & IMU (6‑axis) | Already on the Mark 2 PCB |
| **Wi‑Fi / GSM** module (SIM800C) | Configured with your APN / carrier |
| **Node.js** (v18+) & **npm** | For the backend server |
| **Python** (3.10+) | Runs `ml_model.py` on the server |
| **Twilio** (optional) | For SMS alerts – set up credentials in `.env` |
| **Firebase project** (optional) | Service‑account JSON placed in `backend/` |

---

## 1️⃣ Flash the Firmware

1. Open **Arduino IDE** (or VS Code + PlatformIO).
2. Install the following libraries via the Library Manager:
   - `WiFi.h`
   - `HTTPClient.h`
   - `FirebaseESP32.h`
   - `ESP32Camera.h` (or the camera driver you use)
   - `PulseSensorPlayground.h`
   - `MPU6050.h`
3. Copy the **Mark2‑firmware** (`firmware/mark2_firmware.ino`) into the IDE.
42. Update the **Wi-Fi credentials** and **backend URL** (default `http://<YOUR_PC_IP>:5000/api/iot/location`):
   ```cpp
   const char* ssid     = "YOUR_SSID";
   const char* password = "YOUR_PASSWORD";
   const char* backendUrl = "http://192.168.1.100:5000/api/iot/location"; 
   ```
3. Use the provided firmware in the `firmware/` directory:
   - `esp32_c3_a9g.ino`: Main tracking/SOS firmware.
   - `esp32_cam.ino`: Video streaming firmware.

---

## 3️⃣ Data Flow Overview

```
[ESP32-C3 / A9G] ──► http://<backend>/api/iot/location  (GPS & SOS)
[ESP32-CAM]      ──► http://<backend>/api/camera        (Image uploads)
       │                                 │
       │                                 ▼
       │                         Express route → updates latestData
       │                                 │
       ▼                                 ▼
   GPS Map Updates                Livestream Refresh
```

---

## 4️⃣ New Endpoints

1. **`/api/camera`**: Receives JPEG images from ESP32-CAM and saves as `uploads/latest.jpg`.
2. **`/api/iot/location`**: Receives JSON with `lat`, `lng`, `sos`, and `battery`. Requires `x-device-key` header.


---

## 5️⃣ Testing the End‑to‑End Connection

1. **Power the Mark 2** and watch the serial monitor – you should see messages like:
   ```
   Connecting to Wi‑Fi…
   Connected! IP address: 192.168.1.45
   Sending sensor payload…
   Received response: {"status":"success"}
   ```
2. Open the **dashboard** (`dashboard.html`) in a browser. The **Emotion Status** card should now reflect the real sensor values.
3. Trigger a high‑stress condition (e.g., rapid movement + high heart‑rate). The backend will log:
   ```
   ML Prediction: Panic
   Alert stored in Firebase: <docId>
   SMS sent to +19876543210: SMxxxxxxxxxxxx
   ```
4. Verify the SMS on your phone and check Firestore for the alert document.

---

## 🛠️ Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| No data appears on dashboard | Backend not reachable (wrong IP/port) | Verify `backendUrl` in firmware matches the PC’s IP and that the server is listening on that port. |
| `ECONNREFUSED` in ESP32 logs | Firewall blocks inbound traffic | Open port 5000 on your PC or disable the firewall temporarily. |
| Twilio errors (`Authentication error`) | Missing/incorrect credentials in `.env` | Double‑check `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`. |
| No alerts in Firestore | `serviceAccountKey.json` missing or wrong permissions | Re‑download the service‑account JSON and ensure it has `Firestore` write rights. |
| Camera images not received | `/api/camera` route missing or `multer` not installed | Add the route (see section 4) and run `npm install multer`. |

---

## 📚 References
- **ESP32 Camera Guide** – https://randomnerdtutorials.com/esp32-cam-video-streaming-web-server/
- **PulseSensor Arduino Library** – https://github.com/WorldFamousElectronics/PulseSensorPlayground
- **Firebase Admin Node.js** – https://firebase.google.com/docs/admin/setup
- **Twilio Node.js Quickstart** – https://www.twilio.com/docs/sms/quickstart/node

---

