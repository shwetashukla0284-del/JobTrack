// Entry point: check configuration, connect to MongoDB, then start the API.

require("dotenv").config();

const mongoose = require("mongoose");
const app = require("./app");

const REQUIRED_ENV = ["MONGO_URI", "JWT_SECRET"];

const missing = REQUIRED_ENV.filter((name) => !process.env[name]);

if (missing.length > 0) {
    console.error(
        `Missing required environment variables: ${missing.join(", ")}. ` +
        "Copy backend/.env.example to backend/.env and fill them in."
    );
    process.exit(1);
}

const PORT = process.env.PORT || 5000;

const start = async () => {
    try {
        // Connect first, so the API never accepts requests it can't serve
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB connected");

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

    } catch (error) {
        console.error("MongoDB connection error:", error.message);
        process.exit(1);
    }
};

start();
