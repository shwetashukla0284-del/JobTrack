const express = require("express");

const {
    createJob,
    getJobs,
    getJobById,
    updateJob,
    deleteJob
} = require("../controllers/jobController");

const { exportJobs } = require("../controllers/exportController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

// Create job
router.post("/", protect, createJob);

// Get all jobs
router.get("/", protect, getJobs);

// Export as CSV: /export/applications or /export/status_events
router.get("/export/:dataset", protect, exportJobs);

// Get one specific job
router.get("/:id", protect, getJobById);

// Update job
router.put("/:id", protect, updateJob);

// Delete job
router.delete("/:id", protect, deleteJob);

module.exports = router;