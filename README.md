# WajraConnect 🛡️

WajraConnect is an intelligent, autonomous wearable ecosystem designed for women's safety. It provides real-time monitoring, AI-driven threat detection, and emergency automation.

## 🚀 Quick Start

1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Configure Environment**:
    Create a `backend/.env` file with your credentials (JWT_SECRET, TWILIO_SID, etc.) and your Firebase project details.
3.  **Firebase Setup**:
    Initialize Firebase in the `auth.js` file with your project keys.
4.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    Access the dashboard at `http://localhost:5000` (or your configured PORT).

## 🔌 Connecting Your IoT Device (WAJRAWEAR)

To connect your hardware (ESP32 / Arduino) to the WajraConnect ecosystem:

### 1. Unified API Endpoint
Your device should send periodic sensor data to:
`POST http://<SERVER_IP>:5000/api/iot/ingest`

### 2. Authentication
Every request MUST include the following header:
`X-Device-Key: WajraConnect-device-key-2025`

### 3. Payload Structure (JSON)
The backend expects the following format:
```json
{
  "heartRate": 78,
  "hrv": 45,
  "motionX": 0.02,
  "motionY": 0.05,
  "motionZ": 0.98,
  "lat": 12.9716,
  "lng": 77.5946,
  "battery": 95,
  "userUid": "YOUR_USER_UID_FROM_SETTINGS"
}
```

### 4. Setup Steps
1. Log in to the Web Dashboard.
2. Go to **Settings** to find your unique `User UID`.
3. Update your device firmware with the `Server URL`, `Device Key`, and your `User UID`.
4. Once connected, your live data will appear on the **Dashboard** and **GPS Tracking** pages.

## 🤖 AI Threat Detection
The system uses dual-layer analysis:
- **Biometric Analysis**: Monitors Heart Rate and HRV for signs of panic.
- **Visual Analysis**: The **Livestream** page uses an integrated ML module to analyze camera feeds for suspicious patterns.

## 🛠️ Tech Stack
- **Frontend**: Vanilla JS, Modern CSS (Glassmorphism), Google Fonts (Outfit).
- **Backend**: Node.js, Express.js.
- **Database**: Firebase (Auth & Firestore).
- **AI/ML**: Python (Scikit-Learn, OpenCV) & Client-side JS Inference.
- **Alerting**: Twilio SMS Gateway.

---
*Built with ❤️ for safety and peace of mind.*
