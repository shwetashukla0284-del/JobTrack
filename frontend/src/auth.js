// Login session helpers: the only place that touches the stored token.

const TOKEN_KEY = "token";
const USER_KEY = "user";

export const saveSession = (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearSession = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
};

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const getUser = () => {
    try {
        return JSON.parse(localStorage.getItem(USER_KEY));
    } catch {
        return null;   // corrupted value: treat as logged out
    }
};

// A JWT is three base64url parts: header.payload.signature.
// The payload's "exp" is the expiry time in seconds. Reading it here is only
// to skip a request that would fail anyway; the server still verifies the token.
const tokenExpiry = (token) => {
    try {
        const payload = token.split(".")[1]
            .replace(/-/g, "+")
            .replace(/_/g, "/");

        return JSON.parse(atob(payload)).exp * 1000;
    } catch {
        return 0;
    }
};

export const isLoggedIn = () => {
    const token = getToken();

    if (!token || tokenExpiry(token) <= Date.now()) {
        clearSession();
        return false;
    }

    return true;
};
