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
4. Update the **Wi‑Fi credentials** and **backend URL** (default `http://<YOUR_PC_IP>:5000/api/sensor-data`):
   ```cpp
   const char* ssid     = "YOUR_SSID";
   const char* password = "YOUR_PASSWORD";
   const char* backendUrl = "http://192.168.1.100:5000/api/sensor-data"; // change to your PC IP
   ```
5. **Camera pins** (for OV2640 on ESP32‑C3):
   ```
   #define PWDN_GPIO_NUM    -1
   #define RESET_GPIO_NUM   -1
   #define XCLK_GPIO_NUM    21
   #define SIOD_GPIO_NUM    26
   #define SIOC_GPIO_NUM    27
   #define Y9_GPIO_NUM      35
   #define Y8_GPIO_NUM      34
   #define Y7_GPIO_NUM      39
   #define Y6_GPIO_NUM      36
   #define Y5_GPIO_NUM      19
   #define Y4_GPIO_NUM      18
   #define Y3_GPIO_NUM      5
   #define Y2_GPIO_NUM      4
   #define VSYNC_GPIO_NUM   25
   #define HREF_GPIO_NUM    23
   #define PCLK_GPIO_NUM    22
   ```
6. Verify and **upload** the sketch to the ESP32.

---

## 2️⃣ Backend Configuration

1. **Start the backend** (if not already running):
   ```powershell
   cd d:\DOWNLOADS\WajraConnect-ConnectFINAL-main\WajraConnect-ConnectFINAL-main\backend
   npm start
   ```
2. Ensure the **`.env`** file contains the correct values:
   ```dotenv
   PORT=5000
   TWILIO_ACCOUNT_SID=your_sid   # optional
   TWILIO_AUTH_TOKEN=your_token # optional
   TWILIO_FROM_NUMBER=+1234567890
   EMERGENCY_CONTACTS=+19876543210,+11234567890
   ```
3. If you want alerts stored in Firestore, place the **serviceAccountKey.json** (downloaded from Firebase console) in the same `backend/` folder.

---

## 3️⃣ Data Flow Overview

```
[Mark 2 ESP32] ── Wi‑Fi/GSM ──► http://<backend>/api/sensor-data
      │                                 │
      │                                 ▼
      │                         Express route → `detectEmotion`
      │                                 │
      │                                 ▼
      │                         Python ML (`ml_model.py`)
      │                                 │
      │                                 ▼
      │                         Emotion result stored in memory
      │                                 │
      │                                 ▼
      │                         If Fear/Panic → `triggerAlert`
      │                                 │
      │                                 ├─► Firestore (optional)
      │                                 └─► Twilio SMS (optional)
      ▼
   Camera captures image/video (optional) – you can extend the
   firmware to POST the image to `/api/camera` (endpoint to be added).
```

---

## 4️⃣ Extending the Backend for Camera Data (Optional)

1. **Add a new route** in `server.js`:
   ```javascript
   const multer = require('multer');
   const upload = multer({ dest: 'uploads/' });

   app.post('/api/camera', upload.single('image'), (req, res) => {
     // `req.file` contains the uploaded image
     console.log('Received image from device:', req.file.filename);
     // You could run a vision model here or forward to cloud storage
     res.json({ status: 'ok' });
   });
   ```
2. Install the required packages:
   ```powershell
   npm install multer
   ```
3. Update the ESP32 firmware to send the JPEG frame:
   ```cpp
   // after capturing a frame with the camera library
   http.addHeader("Content-Type", "multipart/form-data");
   int httpResponseCode = http.POST(imageBuffer, imageSize);
   ```

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

