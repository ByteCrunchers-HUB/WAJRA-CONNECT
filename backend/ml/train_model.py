import argparse
import csv
import json
import math
import os
import random
from datetime import datetime, timezone

LABELS = ["Calm", "Stressed", "Fear", "Panic"]
FEATURE_NAMES = [
    "heartRate",
    "hrv",
    "motionMagnitude",
    "motionAbsSum",
    "hrToHrvRatio",
    "hrTimesMotionMagnitude",
]


def extract_features(row):
    hr = float(row["heartRate"])
    hrv = max(float(row["hrv"]), 1.0)
    mx = float(row["motionX"])
    my = float(row["motionY"])
    mz = float(row["motionZ"])
    motion_magnitude = math.sqrt((mx * mx) + (my * my) + (mz * mz))
    motion_abs_sum = abs(mx) + abs(my) + abs(mz)
    hr_to_hrv_ratio = hr / hrv
    hr_times_motion = hr * motion_magnitude
    return [hr, hrv, motion_magnitude, motion_abs_sum, hr_to_hrv_ratio, hr_times_motion]


def load_csv_dataset(input_path):
    if not os.path.exists(input_path):
        return None
    rows = []
    with open(input_path, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            label = row.get("label") or row.get("emotion")
            if label not in LABELS:
                continue
            try:
                features = extract_features(row)
                rows.append((features, label))
            except (ValueError, KeyError):
                continue
    return rows if rows else None


def generate_synthetic_dataset(size=2000):
    rows = []
    for _ in range(size):
        profile = random.random()
        if profile < 0.35:
            label = "Calm"
            hr = random.uniform(60, 85)
            hrv = random.uniform(35, 70)
            m = random.uniform(0.05, 0.8)
        elif profile < 0.65:
            label = "Stressed"
            hr = random.uniform(80, 105)
            hrv = random.uniform(22, 42)
            m = random.uniform(0.3, 1.8)
        elif profile < 0.87:
            label = "Fear"
            hr = random.uniform(95, 130)
            hrv = random.uniform(10, 30)
            m = random.uniform(1.0, 3.0)
        else:
            label = "Panic"
            hr = random.uniform(110, 160)
            hrv = random.uniform(5, 22)
            m = random.uniform(2.0, 5.5)

        theta1 = random.uniform(-1, 1)
        theta2 = random.uniform(-1, 1)
        theta3 = random.uniform(-1, 1)
        row = {
            "heartRate": hr,
            "hrv": hrv,
            "motionX": m * theta1,
            "motionY": m * theta2,
            "motionZ": m * theta3,
        }
        rows.append((extract_features(row), label))
    return rows


def standardize(train_x):
    cols = len(train_x[0])
    means = []
    stds = []
    for c in range(cols):
        values = [r[c] for r in train_x]
        mean = sum(values) / len(values)
        variance = sum((v - mean) ** 2 for v in values) / len(values)
        std = math.sqrt(variance) if variance > 1e-9 else 1.0
        means.append(mean)
        stds.append(std)
    out = [[(r[c] - means[c]) / stds[c] for c in range(cols)] for r in train_x]
    return out, means, stds


def apply_standardization(x, means, stds):
    return [[(r[c] - means[c]) / stds[c] for c in range(len(r))] for r in x]


def sigmoid(v):
    if v < -35:
        return 0.0
    if v > 35:
        return 1.0
    return 1.0 / (1.0 + math.exp(-v))


def train_ovr_logreg(train_x, train_labels, epochs=450, lr=0.06, l2=0.002):
    dim = len(train_x[0])
    weights = {label: [random.uniform(-0.01, 0.01) for _ in range(dim)] for label in LABELS}
    bias = {label: 0.0 for label in LABELS}
    n = len(train_x)

    for _ in range(epochs):
        grad_w = {label: [0.0] * dim for label in LABELS}
        grad_b = {label: 0.0 for label in LABELS}

        for i in range(n):
            x = train_x[i]
            label = train_labels[i]
            for current in LABELS:
                y = 1.0 if label == current else 0.0
                z = sum(weights[current][d] * x[d] for d in range(dim)) + bias[current]
                p = sigmoid(z)
                err = p - y
                for d in range(dim):
                    grad_w[current][d] += err * x[d]
                grad_b[current] += err

        for current in LABELS:
            for d in range(dim):
                grad = (grad_w[current][d] / n) + (l2 * weights[current][d])
                weights[current][d] -= lr * grad
            bias[current] -= lr * (grad_b[current] / n)

    return weights, bias


def predict_probabilities(x, weights, bias):
    raw = {}
    for label in LABELS:
        z = sum(weights[label][i] * x[i] for i in range(len(x))) + bias[label]
        raw[label] = sigmoid(z)
    total = sum(raw.values()) or 1.0
    return {label: raw[label] / total for label in LABELS}


def evaluate_accuracy(test_x, test_y, weights, bias):
    if not test_x:
        return 0.0
    ok = 0
    for i, x in enumerate(test_x):
        probs = predict_probabilities(x, weights, bias)
        pred = max(probs, key=probs.get)
        if pred == test_y[i]:
            ok += 1
    return ok / len(test_x)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="ml/training_data.csv")
    parser.add_argument("--output", default="ml/model.json")
    args = parser.parse_args()

    random.seed(42)
    rows = load_csv_dataset(args.input) or generate_synthetic_dataset()
    random.shuffle(rows)
    split = int(len(rows) * 0.8)

    train_rows = rows[:split]
    test_rows = rows[split:]
    train_x_raw = [r[0] for r in train_rows]
    train_y = [r[1] for r in train_rows]
    test_x_raw = [r[0] for r in test_rows]
    test_y = [r[1] for r in test_rows]

    train_x, means, stds = standardize(train_x_raw)
    test_x = apply_standardization(test_x_raw, means, stds)
    weights, bias = train_ovr_logreg(train_x, train_y)
    accuracy = evaluate_accuracy(test_x, test_y, weights, bias)

    output = {
        "version": "1.0.0",
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "labels": LABELS,
        "features": FEATURE_NAMES,
        "means": means,
        "stds": stds,
        "weights": weights,
        "bias": bias,
        "metrics": {"holdoutAccuracy": round(accuracy, 4), "samples": len(rows)},
    }
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    print(json.dumps({"status": "ok", "output": args.output, "metrics": output["metrics"]}))


if __name__ == "__main__":
    main()
