const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const jobRoutes = require("./routes/jobRoutes");
const protect = require("./middleware/authMiddleware");

console.log("MONGO_URI loaded:", !!process.env.MONGO_URI);

const app = express();

app.use(cors());
app.use(express.json());

// Authentication routes
app.use("/api/auth", authRoutes);

// Job application routes
app.use("/api/jobs", jobRoutes);

// MongoDB connection
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB connected");
    })
    .catch((error) => {
        console.log("MongoDB connection error:", error.message);
    });

// Test route
app.get("/", (req, res) => {
    res.json({
        message: "JobTrack API is running"
    });
});

// Protected test route
app.get("/api/protected", protect, (req, res) => {
    res.json({
        message: "You accessed a protected route!",
        userId: req.userId
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});