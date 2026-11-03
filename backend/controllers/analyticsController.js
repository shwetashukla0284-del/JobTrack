const { getAnalytics } = require("../services/analyticsService");

// =========================
// GET ANALYTICS
// Funnel, response time, weekly trend, conversion by source
// =========================

const getJobAnalytics = async (req, res) => {
    try {
        const analytics = await getAnalytics(req.userId);

        res.status(200).json(analytics);

    } catch (error) {
        console.error("getJobAnalytics error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};

module.exports = {
    getJobAnalytics
};
