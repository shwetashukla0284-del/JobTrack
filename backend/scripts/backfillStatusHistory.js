// One-time migration: give jobs created before status history existed
// an approximate history, so analytics treats every job the same way.
//
//   - "Applied" on the job's dateApplied (or createdAt)
//   - if the current status is not "Applied", that status on updatedAt
//     (the best available guess for when it changed)
//
// Safe to run more than once: only jobs with an empty history are touched.
//
// Usage (from the backend folder):
//   npm run backfill:history           -> dry run, shows what would change
//   npm run backfill:history -- --apply -> writes the changes

const mongoose = require("mongoose");
require("dotenv").config();

const Job = require("../models/job");

const apply = process.argv.includes("--apply");

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI);

    const jobs = await Job.find({
        $or: [
            { statusHistory: { $exists: false } },
            { statusHistory: { $size: 0 } }
        ]
    });

    console.log(`Jobs without status history: ${jobs.length}`);

    for (const job of jobs) {
        const appliedAt = job.dateApplied || job.createdAt;
        const history = [{ status: "Applied", changedAt: appliedAt }];

        if (job.status && job.status !== "Applied") {
            history.push({
                status: job.status,
                changedAt: job.updatedAt || appliedAt
            });
        }

        console.log(
            `${job._id} ${job.company}: ` +
            history.map((event) => event.status).join(" -> ")
        );

        if (apply) {
            // updateOne avoids changing updatedAt, which we just used
            await Job.updateOne(
                { _id: job._id },
                { $set: { statusHistory: history } },
                { timestamps: false }
            );
        }
    }

    console.log(
        apply
            ? "Backfill applied."
            : "Dry run only. Re-run with --apply to save changes."
    );
};

run()
    .catch((error) => {
        console.error("Backfill failed:", error.message);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
