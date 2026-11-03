const bcrypt = require("bcryptjs");
const User = require("../models/user");
const jwt = require("jsonwebtoken");

const MIN_PASSWORD_LENGTH = 6;
// bcrypt only uses the first 72 bytes of a password
const MAX_PASSWORD_LENGTH = 72;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (email) =>
    typeof email === "string" ? email.trim().toLowerCase() : "";

const registerUser = async (req, res) => {
    try {
        const { password } = req.body;
        const name =
            typeof req.body.name === "string" ? req.body.name.trim() : "";
        const email = normalizeEmail(req.body.email);

        // Check required fields
        if (!name || !email || typeof password !== "string" || !password) {
            return res.status(400).json({
                message: "Please provide name, email and password"
            });
        }

        if (!EMAIL_PATTERN.test(email)) {
            return res.status(400).json({
                message: "Please provide a valid email address"
            });
        }

        if (
            password.length < MIN_PASSWORD_LENGTH ||
            Buffer.byteLength(password) > MAX_PASSWORD_LENGTH
        ) {
            return res.status(400).json({
                message: `Password must be ${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters`
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(400).json({
                message: "User already exists"
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await User.create({
            name,
            email,
            password: hashedPassword
        });

        // Send response
        res.status(201).json({
            message: "User registered successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        // Two simultaneous sign-ups with the same email hit the unique index
        if (error.code === 11000) {
            return res.status(400).json({
                message: "User already exists"
            });
        }

        console.error("registerUser error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};

const loginUser = async (req, res) => {
    try {
        const { password } = req.body;
        const email = normalizeEmail(req.body.email);

        // Check required fields
        if (!email || typeof password !== "string" || !password) {
            return res.status(400).json({
                message: "Please provide email and password"
            });
        }

        // Find user by email
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        // Compare entered password with stored hash
        const isPasswordCorrect = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordCorrect) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        // Create JWT
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error("loginUser error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};

module.exports = {
    registerUser,
    loginUser
};