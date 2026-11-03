import axios from "axios";
import { clearSession, getToken } from "./auth";

// Set per environment in .env.development / .env.production
// (or in your hosting provider's environment variables).
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api"
});

// Attach the login token to every request
api.interceptors.request.use((config) => {
    const token = getToken();

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

// An expired or invalid token on any protected request: log out and go to
// the login page. (A 401 from /auth/login just means a wrong password.)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const isAuthRequest = error.config?.url?.startsWith("/auth/");

        if (error.response?.status === 401 && !isAuthRequest) {
            clearSession();
            window.location.assign("/login?expired=1");
        }

        return Promise.reject(error);
    }
);

// A user-friendly message for a failed request, or null when there is
// nothing to show (the 401 redirect above is already handling it).
export const getErrorMessage = (error, fallback = "Something went wrong. Please try again.") => {
    const status = error.response?.status;

    if (status === 401 && !error.config?.url?.startsWith("/auth/")) {
        return null;
    }

    if (!error.response) {
        return "Unable to connect to the server. Please check your connection.";
    }

    // 4xx errors carry a message written for the user (e.g. "Company is required")
    if (status < 500 && error.response.data?.message) {
        return error.response.data.message;
    }

    return fallback;
};

export default api;
