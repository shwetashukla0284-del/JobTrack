const { describe, test, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../app");
const { escapeCsvValue } = require("../services/exportService");
const { startDb, clearDb, stopDb, createUser, auth } = require("./helpers");

before(startDb);
afterEach(clearDb);
after(stopDb);

// Raw bytes, so we can check the BOM is really there
const download = (token, dataset) =>
    request(app)
        .get(`/api/jobs/export/${dataset}`)
        .set(auth(token))
        .buffer(true)
        .parse((response, callback) => {
            const chunks = [];
            response.on("data", (chunk) => chunks.push(chunk));
            response.on("end", () => callback(null, Buffer.concat(chunks)));
        });

describe("escapeCsvValue", () => {
    for (const [input, expected] of [
        ["plain", "plain"],
        ["Acme, Inc.", '"Acme, Inc."'],
        ['He said "hi"', '"He said ""hi"""'],
        ["two\nlines", '"two\nlines"'],
        ["=HYPERLINK(1)", "'=HYPERLINK(1)"],
        ["-Remote", "'-Remote"],
        ["@sum", "'@sum"],
        [null, ""],
        [undefined, ""]
    ]) {
        test(`${JSON.stringify(input)} -> ${JSON.stringify(expected)}`, () => {
            assert.equal(escapeCsvValue(input), expected);
        });
    }
});

describe("GET /api/jobs/export/:dataset", () => {
    test("requires login and a known dataset", async () => {
        const { token } = await createUser(app);

        assert.equal((await request(app).get("/api/jobs/export/applications")).status, 401);
        assert.equal((await request(app).get("/api/jobs/export/passwords").set(auth(token))).status, 400);
    });

    test("exports the user's applications as UTF-8 CSV with a BOM, safe headers and CRLF lines", async () => {
        const { token } = await createUser(app);
        const other = await createUser(app);

        await request(app).post("/api/jobs").set(auth(other.token)).send({ company: "OTHER CO", role: "x" });
        await request(app).post("/api/jobs").set(auth(token))
            .send({ company: "Zürich, ₹ Ltd", role: "DA", source: "LinkedIn", dateApplied: "2026-10-01" });

        const response = await download(token, "applications");

        assert.equal(response.status, 200);
        assert.match(response.headers["content-type"], /text\/csv; charset=utf-8/);
        assert.match(response.headers["content-disposition"],
            /^attachment; filename="jobtrack_applications_\d{4}-\d{2}-\d{2}\.csv"$/);
        assert.equal(response.headers["cache-control"], "no-store");

        const bytes = response.body;
        assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);

        const text = bytes.toString("utf8");
        const lines = text.slice(1).split("\r\n");
        assert.equal(lines[0], "job_id,company,role,location,source,current_status,date_applied,created_at,updated_at");
        assert.match(lines[1], /^[0-9a-f]{24},"Zürich, ₹ Ltd",DA,,LinkedIn,Applied,2026-10-01,/);
        assert.equal(lines.length, 3);   // header, one row, trailing empty string
        assert.doesNotMatch(text, /OTHER CO|@test\.com/);
    });

    test("exports one row per status change", async () => {
        const { token } = await createUser(app);
        const id = (await request(app).post("/api/jobs").set(auth(token))
            .send({ company: "Acme", role: "DA", dateApplied: "2026-10-01" })).body.job._id;
        await request(app).put(`/api/jobs/${id}`).set(auth(token)).send({ status: "Interview" });

        const lines = (await download(token, "status_events")).body.toString("utf8").slice(1).trim().split("\r\n");

        assert.equal(lines[0], "job_id,event_number,status,changed_at");
        assert.deepEqual(lines.slice(1).map((line) => line.split(",").slice(0, 3)), [
            [id, "1", "Applied"],
            [id, "2", "Interview"]
        ]);
        assert.equal(lines[1].split(",")[3], "2026-10-01T00:00:00.000Z");
    });
});
