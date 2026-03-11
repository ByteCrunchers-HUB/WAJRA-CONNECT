/**
 * Shared auth/API helpers for WajraConnect frontend.
 */
const API = localStorage.getItem("vw_api_base") || "http://localhost:5000";

function getApiBase() {
    return API;
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
}

async function apiFetch(path, options = {}) {
    const token = getToken();
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (token) headers.Authorization = "Bearer " + token;
    return fetch(API + path, { ...options, headers });
}

async function parseApiJson(res) {
    try {
        return await res.json();
    } catch (e) {
        return null;
    }
}

async function requireLogin() {
    const token = getToken();
    if (!token) {
        window.location.href = "index.html";
        return null;
    }
    try {
        const res = await apiFetch("/api/auth/me");
        if (!res.ok) {
            clearSession();
            window.location.href = "index.html";
            return null;
        }
        const data = await parseApiJson(res);
        return data && data.user ? data.user : getUser();
    } catch (e) {
        const cached = getUser();
        if (!cached) {
            window.location.href = "index.html";
            return null;
        }
        return cached;
    }
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
    const resetBtn = document.getElementById("resetPasswordBtn");

    if (!userCircle || !userDropdown) return;

    const initials = getInitials(user.name, user.email);
    userCircle.textContent = initials;
    if (dropName) dropName.textContent = user.name || "(No name)";
    if (dropEmail) dropEmail.textContent = user.email || "";

    userCircle.addEventListener("click", (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle("show");
    });

    document.addEventListener("click", (e) => {
        if (!userDropdown.contains(e.target) && !userCircle.contains(e.target)) {
            userDropdown.classList.remove("show");
        }
    });

    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            clearSession();
            window.location.href = "signup.html";
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            window.location.href = "reset.html";
        });
    }
}
