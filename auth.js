/**
 * WajraConnect Firebase Integration Module
 * Replace the configuration above with your project settings from Firebase Console
 */

// Your Firebase configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase (Assuming Firebase SDK is loaded via CDN in HTML)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

/**
 * Shared auth/API helpers for WajraConnect frontend (Firebase Version).
 */

function getApiBase() {
    return "FIREBASE_INTERNAL";
}

function getToken() {
    return localStorage.getItem("vw_token");
}

function getUser() {
    try {
        return JSON.parse(localStorage.getItem("vw_user"));
    } catch (e) {
        return null;
    }
}

function saveSession(token, user) {
    localStorage.setItem("vw_token", token);
    localStorage.setItem("vw_user", JSON.stringify(user));
}

function clearSession() {
    localStorage.removeItem("vw_token");
    localStorage.removeItem("vw_user");
    return auth.signOut();
}

/**
 * requireLogin - Verifies Firebase session
 */
async function requireLogin() {
    return new Promise((resolve) => {
        auth.onAuthStateChanged(async (user) => {
            if (!user) {
                clearSession();
                if (!window.location.pathname.includes("index.html") && !window.location.pathname.includes("signup.html")) {
                    window.location.href = "index.html";
                }
                resolve(null);
            } else {
                // Fetch profile from Firestore
                const userDoc = await db.collection("users").doc(user.uid).get();
                const userData = {
                    id: user.uid,
                    uid: user.uid,
                    email: user.email,
                    name: user.displayName || (userDoc.exists ? userDoc.data().name : ""),
                    role: "User"
                };
                saveSession(user.uid, userData);
                resolve(userData);
            }
        });
    });
}

function getInitials(name, email) {
    if (name && name.trim().length > 0) {
        const parts = name.trim().split(" ").filter(Boolean);
        let initials = parts[0][0] || "";
        if (parts.length > 1) initials += parts[1][0] || "";
        return initials.toUpperCase();
    }
    if (email) return email.slice(0, 2).toUpperCase();
    return "--";
}

function initUserMenu(user) {
    const userCircle = document.getElementById("userCircle");
    const userDropdown = document.getElementById("userDropdown");
    const dropName = document.getElementById("dropdownName");
    const dropEmail = document.getElementById("dropdownEmail");
    const logoutBtn = document.getElementById("logoutBtn");

    if (!userCircle || !userDropdown) return;

    const initials = getInitials(user.name, user.email);
    userCircle.textContent = initials;
    if (dropName) dropName.textContent = user.name || "(No name)";
    if (dropEmail) dropEmail.textContent = user.email || "";

    userCircle.addEventListener("click", (e) => {
        e.stopPropagation();
        userDropdown.style.display = userDropdown.style.display === "flex" ? "none" : "flex";
    });

    document.addEventListener("click", (e) => {
        if (!userDropdown.contains(e.target) && !userCircle.contains(e.target)) {
            userDropdown.style.display = "none";
        }
    });

    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            await clearSession();
            window.location.href = "index.html";
        });
    }
}

/**
 * Client-Side ML Logic (Standardizing features and predicting)
 */
const ML_MODEL = {
    // Ported from backend/ml/model.json
    "labels": ["Calm", "Stressed", "Fear", "Panic"],
    "means": [95.4648, 33.9498, 1.3231, 2.0557, 4.3105, 147.0663],
    "stds": [22.741, 16.5638, 1.2341, 1.9631, 4.0679, 168.1155],
    "weights": {
        "Calm": [-1.2945, 1.7239, -0.403, -0.3934, -0.2632, -0.2076],
        "Stressed": [0.1533, -1.0985, -0.1641, -0.0522, -1.0989, -0.5927],
        "Fear": [0.7131, -1.2917, 0.107, 0.0945, -0.4476, -0.4615],
        "Panic": [0.4634, 0.1418, 0.2805, 0.1957, 0.8141, 0.6049]
    },
    "bias": { "Calm": -1.7377, "Stressed": -1.0062, "Fear": -1.5334, "Panic": -2.608 },
    "riskWeights": { "Calm": 0.1, "Stressed": 0.45, "Fear": 0.75, "Panic": 0.95 }
};

function sigmoid(v) { return 1.0 / (1.0 + Math.exp(-v)); }

function runClientInference(hr, hrv, mx, my, mz) {
    const mag = Math.sqrt(mx * mx + my * my + mz * mz);
    const absSum = Math.abs(mx) + Math.abs(my) + Math.abs(mz);
    const features = [hr, hrv, mag, absSum, hr / (hrv || 1), hr * mag];

    const x_std = features.map((v, i) => (v - ML_MODEL.means[i]) / ML_MODEL.stds[i]);

    let raw = {};
    ML_MODEL.labels.forEach(label => {
        let z = ML_MODEL.weights[label].reduce((sum, w, i) => sum + (w * x_std[i]), 0) + ML_MODEL.bias[label];
        raw[label] = sigmoid(z);
    });

    const total = Object.values(raw).reduce((a, b) => a + b, 0);
    const probs = {};
    ML_MODEL.labels.forEach(l => probs[l] = raw[l] / total);

    const emotion = Object.keys(probs).reduce((a, b) => probs[a] > probs[b] ? a : b);
    const riskScore = ML_MODEL.labels.reduce((sum, l) => sum + (probs[l] * ML_MODEL.riskWeights[l]), 0);

    return { emotion, confidence: probs[emotion], riskScore };
}
