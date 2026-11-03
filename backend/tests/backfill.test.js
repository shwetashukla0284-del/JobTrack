// The one-time migration script, run as a separate process like in real use.

const { test, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { execFileSync } = require("child_process");
const mongoose = require("mongoose");
const Job = require("../models/job");
const { startDb, clearDb, stopDb, dbUri } = require("./helpers");

before(startDb);
afterEach(clearDb);
after(stopDb);

const script = path.join(__dirname, "..", "scripts", "backfillStatusHistory.js");
const run = (...args) =>
    execFileSync("node", [script, ...args], {
        env: { ...process.env, MONGO_URI: dbUri() },
        encoding: "utf8"
    });

test("dry run changes nothing; --apply fills missing history without touching updatedAt", async () => {
    const userId = new mongoose.Types.ObjectId();
    await Job.collection.insertOne({
        userId, company: "Legacy", role: "DA", status: "Interview",
        dateApplied: new Date("2026-10-14"), createdAt: new Date("2026-10-14"), updatedAt: new Date("2026-10-18")
    });

    assert.match(run(), /Jobs without status history: 1[\s\S]*Dry run only/);
    assert.equal((await Job.collection.findOne({ company: "Legacy" })).statusHistory, undefined);

    run("--apply");
    const job = await Job.collection.findOne({ company: "Legacy" });

    assert.deepEqual(job.statusHistory, [
        { status: "Applied", changedAt: new Date("2026-10-14") },
        { status: "Interview", changedAt: new Date("2026-10-18") }
    ]);
    assert.deepEqual(job.updatedAt, new Date("2026-10-18"));

    // Safe to run again: nothing left to do
    assert.match(run(), /Jobs without status history: 0/);
});
