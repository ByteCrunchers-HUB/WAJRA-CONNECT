# ML + Real IoT Integration Guide

This backend now supports:

- trainable ML model (`ml/train_model.py`)
- live inference (`ml/infer.py`)
- secure device ingestion endpoint (`POST /api/iot/ingest`)

## 1) Train the model

```bash
npm run train:ml
```

Optional: provide labeled CSV at `ml/training_data.csv` with columns:

- `heartRate`
- `hrv`
- `motionX`
- `motionY`
- `motionZ`
- `label` (`Calm`, `Stressed`, `Fear`, `Panic`)

If no CSV is provided, synthetic data is generated for baseline training.

## 2) Run backend

```bash
npm start
```

Important `.env` values:

- `DEVICE_API_KEY` (required for device requests)
- `RISK_ALERT_THRESHOLD` (default `0.72`)
- `PYTHON_EXEC` (default `python`)

## 3) IoT ingestion API

`POST /api/iot/ingest`

Headers:

- `x-device-key: <DEVICE_API_KEY>`

Body example:

```json
{
  "deviceId": "esp32-001",
  "userUid": "clx123abc",
  "heartRate": 122,
  "hrv": 16,
  "motionX": 2.8,
  "motionY": -1.2,
  "motionZ": 0.9,
  "lat": 17.385,
  "lng": 78.4867,
  "battery": 64.2,
  "timestamp": 1762030200000
}
```

Response includes:

- `prediction.emotion`
- `prediction.confidence`
- `prediction.riskScore`
- `prediction.classProbabilities`

## 4) ESP32 firmware request template

```cpp
// Send JSON to WajraConnect backend from ESP32.
HTTPClient http;
http.begin("http://<SERVER_IP>:5000/api/iot/ingest");
http.addHeader("Content-Type", "application/json");
http.addHeader("x-device-key", "WajraConnect-device-key");

String body = "{\"deviceId\":\"esp32-001\",\"heartRate\":118,\"hrv\":20,"
              "\"motionX\":1.2,\"motionY\":-0.4,\"motionZ\":0.6,"
              "\"lat\":12.9716,\"lng\":77.5946,\"battery\":73.4,"
              "\"timestamp\":1700000000000}";
int code = http.POST(body);
String response = http.getString();
http.end();
```

## 5) Useful endpoints

- `GET /api/status`
- `GET /api/ml/model-info`
- `POST /api/sensor-data` (legacy/non-device route, no device key)
