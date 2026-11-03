// The Express application: middleware, routes and error handling.
// Kept separate from server.js (which connects to MongoDB and starts
// listening) so tests can load the app without starting a server.

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/authRoutes");
const jobRoutes = require("./routes/jobRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");

const app = express();

// Render (and most hosts) put the app behind one proxy. Trusting it lets the
// rate limiter see each visitor's real IP instead of the proxy's.
app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 1));

// =========================
// CORS
// Set CORS_ORIGINS to a comma-separated list of allowed frontend URLs, e.g.
//   CORS_ORIGINS=https://jobtrack.example.com,http://localhost:5173
// Unset: every origin is allowed (the API uses bearer tokens, not cookies,
// so this is not a CSRF risk, but restricting it is good practice).
// =========================

const allowedOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(
    cors(allowedOrigins.length > 0 ? { origin: allowedOrigins } : {})
);

app.use(express.json({ limit: "100kb" }));

// =========================
// RATE LIMIT
// Slows down password guessing and sign-up spam
// =========================

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.AUTH_RATE_LIMIT || 20),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        message: "Too many attempts. Please wait 15 minutes and try again."
    }
});

// =========================
// ROUTES
// =========================

app.get("/", (req, res) => {
    res.json({
        message: "JobTrack API is running"
    });
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/analytics", analyticsRoutes);

// =========================
// ERRORS (always JSON, never an HTML page or stack trace)
// =========================

app.use((req, res) => {
    res.status(404).json({
        message: "Not found"
    });
});

// Express recognises an error handler by its four arguments
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
    if (error.type === "entity.parse.failed") {
        return res.status(400).json({
            message: "Invalid JSON in request body"
        });
    }

    if (error.type === "entity.too.large") {
        return res.status(413).json({
            message: "Request body is too large"
        });
    }

    console.error("Unhandled error:", error);

    res.status(500).json({
        message: "Server error"
    });
});

module.exports = app;
