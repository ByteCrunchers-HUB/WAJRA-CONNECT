# WajraConnect Setup Guide

## Prerequisites

- Node.js 18+
- Python 3.9+
- npm

## 1) Open project

```bash
cd D:\DOWNLOADS\WajraConnect-ConnectFINAL-main\WajraConnect-ConnectFINAL-main
```

## 2) Configure backend environment

File: `backend/.env`

Minimum required values:

```env
PORT=5000
DATABASE_URL="file:./dev.db"
JWT_SECRET=change_this_secret
DEVICE_API_KEY=WajraConnect-device-key
RISK_ALERT_THRESHOLD=0.72
PYTHON_EXEC=python
```

Optional (for SMS alerts):

```env
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
EMERGENCY_CONTACTS=+911234567890,+919876543210
```

## 3) Install backend dependencies

```bash
cd backend
npm install
```

## 4) Train ML model

```bash
npm run train:ml
```

This creates `backend/ml/model.json`.

## 5) Start backend

```bash
npm start
```

Backend runs on:

- `http://localhost:5000`

## 6) Run frontend

From project root (`WajraConnect-ConnectFINAL-main`), open with Live Server (VS Code) or any static server.

If you use Python static server:

```bash
cd ..
python -m http.server 5500
```

Then open:

- `http://localhost:5500/index.html`

## 7) Login and test

1. Create account on `signup.html`
2. Login on `login.html` (or `index.html`)
3. Dashboard/GPS/Alerts will pull from backend APIs

## 8) Quick health checks

- `GET http://localhost:5000/api/status`
- `GET http://localhost:5000/api/ml/model-info`

