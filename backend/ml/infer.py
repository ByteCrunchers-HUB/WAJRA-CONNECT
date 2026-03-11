import json
import math
import os
import sys

RISK_WEIGHTS = {
    "Calm": 0.1,
    "Stressed": 0.45,
    "Fear": 0.75,
    "Panic": 0.95,
}


def sigmoid(v):
    if v < -35:
        return 0.0
    if v > 35:
        return 1.0
    return 1.0 / (1.0 + math.exp(-v))


def extract_features(hr, hrv, mx, my, mz):
    hrv_safe = max(hrv, 1.0)
    motion_magnitude = math.sqrt((mx * mx) + (my * my) + (mz * mz))
    motion_abs_sum = abs(mx) + abs(my) + abs(mz)
    hr_to_hrv_ratio = hr / hrv_safe
    hr_times_motion = hr * motion_magnitude
    return [hr, hrv, motion_magnitude, motion_abs_sum, hr_to_hrv_ratio, hr_times_motion]


def load_model(model_path):
    with open(model_path, "r", encoding="utf-8") as f:
        return json.load(f)


def standardize(values, means, stds):
    out = []
    for i, v in enumerate(values):
        std = stds[i] if stds[i] and stds[i] > 1e-9 else 1.0
        out.append((v - means[i]) / std)
    return out


def predict(model, hr, hrv, mx, my, mz):
    labels = model["labels"]
    x = extract_features(hr, hrv, mx, my, mz)
    x_std = standardize(x, model["means"], model["stds"])

    raw = {}
    for label in labels:
        w = model["weights"][label]
        b = model["bias"][label]
        z = sum((w[i] * x_std[i]) for i in range(len(x_std))) + b
        raw[label] = sigmoid(z)
    total = sum(raw.values()) or 1.0
    probs = {k: raw[k] / total for k in labels}

    emotion = max(probs, key=probs.get)
    confidence = probs[emotion]
    risk = sum(probs[k] * RISK_WEIGHTS.get(k, 0.5) for k in labels)
    return {
        "emotion": emotion,
        "confidence": round(confidence, 4),
        "riskScore": round(risk, 4),
        "classProbabilities": {k: round(v, 4) for k, v in probs.items()},
        "modelVersion": model.get("version", "unknown"),
    }


def main():
    model_path = os.environ.get("VIRAWEAR_MODEL_PATH", os.path.join("ml", "model.json"))
    if "--model-info" in sys.argv:
        model = load_model(model_path)
        print(
            json.dumps(
                {
                    "version": model.get("version", "unknown"),
                    "trainedAt": model.get("trainedAt"),
                    "metrics": model.get("metrics"),
                    "features": model.get("features"),
                }
            )
        )
        return

    if len(sys.argv) < 6:
        print(json.dumps({"error": "Insufficient arguments"}))
        sys.exit(1)

    if not os.path.exists(model_path):
        print(json.dumps({"error": f"Model file not found at {model_path}"}))
        sys.exit(1)

    try:
        hr = float(sys.argv[1])
        hrv = float(sys.argv[2])
        mx = float(sys.argv[3])
        my = float(sys.argv[4])
        mz = float(sys.argv[5])
    except ValueError:
        print(json.dumps({"error": "Invalid input format"}))
        sys.exit(1)

    model = load_model(model_path)
    print(json.dumps(predict(model, hr, hrv, mx, my, mz)))


if __name__ == "__main__":
    main()
