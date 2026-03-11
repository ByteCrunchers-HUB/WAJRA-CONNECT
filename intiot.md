# IoT Integration Guide (intiot)

This document explains how to connect a real IoT wearable (ESP32/Arduino + sensors) to WajraConnect.

## Backend endpoint

Use:

- `POST /api/iot/ingest`
- Full URL: `http://<SERVER_IP>:5000/api/iot/ingest`

Required header:

- `x-device-key: <DEVICE_API_KEY>`

`DEVICE_API_KEY` must match value in `backend/.env`.

## Required payload fields

```json
{
  "deviceId": "esp32-001",
  "userUid": "your_user_uid",
  "heartRate": 118,
  "hrv": 22,
  "motionX": 1.7,
  "motionY": -0.8,
  "motionZ": 0.5,
  "lat": 17.385,
  "lng": 78.4867,
  "battery": 74.3,
  "timestamp": 1762030200000
}
```

Minimum required by backend validator:

- `heartRate`, `hrv`, `motionX`, `motionY`, `motionZ`

Recommended:

- `deviceId`, `userUid`, `lat`, `lng`, `battery`, `timestamp`

## Backend response

Example:

```json
{
  "status": "accepted",
  "deviceId": "esp32-001",
  "prediction": {
    "emotion": "Fear",
    "confidence": 0.44,
    "riskScore": 0.80,
    "classProbabilities": {
      "Calm": 0.01,
      "Stressed": 0.12,
      "Fear": 0.44,
      "Panic": 0.43
    },
    "modelVersion": "1.0.0"
  },
  "action": "alert-evaluated"
}
```

If risk is high (`riskScore >= RISK_ALERT_THRESHOLD`) or emotion is `Fear/Panic`, backend stores alert and can send SMS (if Twilio configured).

## ESP32 HTTP example (Arduino style)

```cpp
#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid = "YOUR_WIFI";
const char* pass = "YOUR_PASS";
const char* url = "http://192.168.1.100:5000/api/iot/ingest"; // backend IP in same LAN
const char* deviceKey = "WajraConnect-device-key";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, pass);
  while (WiFi.status() != WL_CONNECTED) delay(300);
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-key", deviceKey);

    String body =
      "{\"deviceId\":\"esp32-001\",\"userUid\":\"your_user_uid\","
      "\"heartRate\":120,\"hrv\":18,"
      "\"motionX\":2.2,\"motionY\":-0.6,\"motionZ\":0.9,"
      "\"lat\":12.9716,\"lng\":77.5946,"
      "\"battery\":68.2,\"timestamp\":1700000000000}";

    int code = http.POST(body);
    String response = http.getString();
    Serial.printf("HTTP %d\n%s\n", code, response.c_str());
    http.end();
  }
  delay(5000);
}
```

## Mapping from sensors

- `heartRate`: BPM from heart-rate sensor
- `hrv`: heart-rate variability (ms)
- `motionX/Y/Z`: accelerometer/IMU axes
- `lat/lng`: GPS module output
- `battery`: battery percentage (0-100)

## Common integration checks

1. Backend running on `0.0.0.0:5000` (not only localhost) when using physical device.
2. Device and backend machine are on same network.
3. Firewall allows inbound port `5000`.
4. `x-device-key` matches `backend/.env`.
5. Device sends valid JSON and numeric sensor values.

