const { DATASETS, exportDataset } = require("../services/exportService");

// =========================
// EXPORT CSV
// GET /api/jobs/export/applications
// GET /api/jobs/export/status_events
// =========================

const exportJobs = async (req, res) => {
    try {
        const { dataset } = req.params;

        if (!DATASETS.includes(dataset)) {
            return res.status(400).json({
                message: `Dataset must be one of: ${DATASETS.join(", ")}`
            });
        }

        const csv = await exportDataset(req.userId, dataset);
        const today = new Date().toISOString().slice(0, 10);

        res.set({
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition":
                `attachment; filename="jobtrack_${dataset}_${today}.csv"`,
            // Personal data: don't let browsers or proxies cache it
            "Cache-Control": "no-store"
        });

        res.status(200).send(csv);

    } catch (error) {
        console.error("exportJobs error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};

module.exports = {
    exportJobs
};
