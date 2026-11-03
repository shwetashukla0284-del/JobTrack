const express = require("express");

const { getJobAnalytics } = require("../controllers/analyticsController");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

// Analytics for the logged-in user's applications
router.get("/", protect, getJobAnalytics);

module.exports = router;
