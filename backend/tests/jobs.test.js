const { describe, test, before, after, afterEach, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../app");
const Job = require("../models/job");
const { startDb, clearDb, stopDb, createUser, auth, assertIncludes } = require("./helpers");

before(startDb);
afterEach(clearDb);
after(stopDb);

const createJob = (token, body) =>
    request(app).post("/api/jobs").set(auth(token)).send(body);

describe("authentication", () => {
    test("rejects requests without a token", async () => {
        assert.equal((await request(app).get("/api/jobs")).status, 401);
    });

    test("rejects an unsigned ('alg: none') token", async () => {
        const encode = (object) => Buffer.from(JSON.stringify(object)).toString("base64url");
        const forged = `${encode({ alg: "none", typ: "JWT" })}.${encode({ userId: "6aea2a77a152d96602444b79" })}.`;

        assert.equal((await request(app).get("/api/jobs").set(auth(forged))).status, 401);
    });
});

describe("POST /api/jobs", () => {
    test("creates a job with trimmed fields and an initial status history", async () => {
        const { token } = await createUser(app);

        const response = await createJob(token, {
            company: "  Acme  ", role: "Data Analyst", status: "Interview",
            source: "Referral", location: " Pune ", dateApplied: "2026-10-05"
        });

        assert.equal(response.status, 201);
        const { job } = response.body;
        assertIncludes(job, { company: "Acme", location: "Pune", source: "Referral", status: "Interview" });
        assert.deepEqual(job.statusHistory.map((event) => event.status), ["Applied", "Interview"]);
        assert.equal(job.statusHistory[0].changedAt, "2026-10-05T00:00:00.000Z");
    });

    test("an empty source means 'not specified'", async () => {
        const { token } = await createUser(app);
        const response = await createJob(token, { company: "A", role: "B", source: "" });

        assert.equal(response.status, 201);
        assert.equal(response.body.job.source, undefined);
    });

    for (const [name, body] of [
        ["missing company", { role: "B" }],
        ["non-string company", { company: 5, role: "B" }],
        ["blank role", { company: "A", role: "   " }],
        ["unknown status", { company: "A", role: "B", status: "Ghosted" }],
        ["unknown source", { company: "A", role: "B", source: "Twitter" }],
        ["invalid date", { company: "A", role: "B", dateApplied: "not-a-date" }],
        ["future date", { company: "A", role: "B", dateApplied: "2099-01-01" }]
    ]) {
        test(`rejects ${name} with 400`, async () => {
            const { token } = await createUser(app);
            const response = await createJob(token, body);

            assert.equal(response.status, 400);
            assert.equal(typeof response.body.message, "string");
        });
    }
});

describe("PUT /api/jobs/:id", () => {
    let token;
    let id;

    beforeEach(async () => {
        ({ token } = await createUser(app));
        id = (await createJob(token, { company: "Acme", role: "DA", dateApplied: "2026-10-01" })).body.job._id;
    });

    const update = (body, asToken = token) =>
        request(app).put(`/api/jobs/${id}`).set(auth(asToken)).send(body);

    test("a status change adds a history event; the same status again does not", async () => {
        await update({ status: "Interview" }).expect(200);
        const response = await update({ status: "Interview", location: "Remote" }).expect(200);

        assert.deepEqual(response.body.job.statusHistory.map((event) => event.status), ["Applied", "Interview"]);
        assert.equal(response.body.job.location, "Remote");
    });

    test("changing the date applied also moves the first 'Applied' event", async () => {
        const response = await update({ dateApplied: "2026-09-20" }).expect(200);

        assert.equal(response.body.job.statusHistory[0].changedAt, "2026-09-20T00:00:00.000Z");
    });

    test("the date applied can't move to after the first response", async () => {
        // A rejection recorded on 10 Oct
        await Job.updateOne({ _id: id }, {
            status: "Rejected",
            $push: { statusHistory: { status: "Rejected", changedAt: new Date("2026-10-10T09:00:00Z") } }
        });

        const tooLate = await update({ dateApplied: "2026-10-20" });
        assert.equal(tooLate.status, 400);
        assert.equal(tooLate.body.message, "Date applied cannot be after the first status change");

        // Same day as the reply is fine (timezone tolerance)
        assert.equal((await update({ dateApplied: "2026-10-10" })).status, 200);
    });

    test("users can't read, edit or delete someone else's job", async () => {
        const other = await createUser(app);

        assert.equal((await request(app).get(`/api/jobs/${id}`).set(auth(other.token))).status, 404);
        assert.equal((await update({ status: "Offer" }, other.token)).status, 404);
        assert.equal((await request(app).delete(`/api/jobs/${id}`).set(auth(other.token))).status, 404);
        assert.equal((await request(app).get(`/api/jobs/${id}`).set(auth(token))).status, 200);
    });

    test("an invalid ID returns 400", async () => {
        assert.equal((await request(app).get("/api/jobs/not-an-id").set(auth(token))).status, 400);
    });

    test("DELETE removes the job", async () => {
        await request(app).delete(`/api/jobs/${id}`).set(auth(token)).expect(200);

        assert.equal((await request(app).get(`/api/jobs/${id}`).set(auth(token))).status, 404);
    });
});

describe("GET /api/jobs (search, filter, pagination)", () => {
    let token;

    beforeEach(async () => {
        ({ token } = await createUser(app));
        await createJob(token, { company: "C++ (Remote) Labs", role: "DA", dateApplied: "2026-10-03" });
        await createJob(token, { company: "Beta", role: "BA", status: "Interview", dateApplied: "2026-10-01" });
        await createJob(token, { company: "Gamma", role: "DA", location: "Pune", dateApplied: "2026-10-02" });
    });

    const list = (query) => request(app).get("/api/jobs").query(query).set(auth(token));
    const companies = (response) => response.body.jobs.map((job) => job.company);

    test("search treats regex characters literally", async () => {
        const response = await list({ search: "c++ (remote" });

        assert.equal(response.status, 200);
        assert.deepEqual(companies(response), ["C++ (Remote) Labs"]);
    });

    test("search covers company, role and location", async () => {
        assert.deepEqual(companies(await list({ search: "pune" })), ["Gamma"]);
    });

    test("filters by status", async () => {
        assert.deepEqual(companies(await list({ status: "Interview" })), ["Beta"]);
    });

    test("sorts by date applied, newest first, and paginates", async () => {
        const page1 = await list({ page: 1, limit: 2 });
        const page2 = await list({ page: 2, limit: 2 });

        assert.deepEqual(companies(page1), ["C++ (Remote) Labs", "Gamma"]);
        assert.deepEqual(companies(page2), ["Beta"]);
        assertIncludes(page1.body, { totalJobs: 3, totalPages: 2, currentPage: 1 });
    });

    for (const [name, query] of [
        ["page 0", { page: 0 }],
        ["limit 51", { limit: 51 }],
        ["unknown status", { status: "Ghosted" }],
        ["search as an array", { search: ["a", "b"] }]
    ]) {
        test(`rejects ${name} with 400`, async () => {
            assert.equal((await list(query)).status, 400);
        });
    }

    test("includes dashboard statistics for all of the user's jobs", async () => {
        const { statistics } = (await list({ search: "Gamma" })).body;

        assertIncludes(statistics, { applications: 3, reachedInterview: 1, interviewRate: 33.3 });
    });
});
