// App-level behaviour: error responses, CORS and rate limiting.
// These don't need a database.

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

// A fresh copy of the app with specific settings (CORS and rate-limit
// settings are read when app.js is loaded, so clear it from the cache).
const loadApp = (env = {}) => {
    const saved = { ...process.env };
    Object.assign(process.env, env);
    delete require.cache[require.resolve("../app")];
    const app = require("../app");
    for (const key of Object.keys(env)) {
        if (key in saved) process.env[key] = saved[key];
        else delete process.env[key];
    }
    return app;
};

describe("error responses are JSON, never HTML or stack traces", () => {
    const app = loadApp();

    test("health check", async () => {
        const response = await request(app).get("/");
        assert.deepEqual(response.body, { message: "JobTrack API is running" });
    });

    test("malformed JSON -> 400", async () => {
        const response = await request(app)
            .post("/api/auth/login")
            .set("Content-Type", "application/json")
            .send("{bad json");

        assert.equal(response.status, 400);
        assert.match(response.headers["content-type"], /application\/json/);
        assert.deepEqual(response.body, { message: "Invalid JSON in request body" });
        assert.doesNotMatch(response.text, /node_modules|at JSON\.parse/);
    });

    test("body over 100kb -> 413", async () => {
        const response = await request(app).post("/api/jobs").send({ notes: "x".repeat(200_000) });

        assert.equal(response.status, 413);
        assert.equal(response.body.message, "Request body is too large");
    });

    test("unknown route -> 404", async () => {
        const response = await request(app).get("/api/does-not-exist");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, { message: "Not found" });
    });
});

describe("CORS", () => {
    test("with CORS_ORIGINS set, only those origins are allowed", async () => {
        const app = loadApp({ CORS_ORIGINS: "https://app.example.com, http://localhost:5173" });

        const allowed = await request(app).get("/").set("Origin", "https://app.example.com");
        const blocked = await request(app).get("/").set("Origin", "https://evil.example");

        assert.equal(allowed.headers["access-control-allow-origin"], "https://app.example.com");
        assert.equal(blocked.headers["access-control-allow-origin"], undefined);
    });

    test("without CORS_ORIGINS, any origin is allowed", async () => {
        const app = loadApp();
        const response = await request(app).get("/").set("Origin", "https://anything.example");

        assert.equal(response.headers["access-control-allow-origin"], "*");
    });
});

describe("login rate limit", () => {
    test("blocks after AUTH_RATE_LIMIT attempts, without affecting other routes", async () => {
        const app = loadApp({ AUTH_RATE_LIMIT: "3" });
        // No database needed: an empty login fails validation (400) but still counts
        const attempt = () => request(app).post("/api/auth/login").send({});

        const statuses = [];
        for (let i = 0; i < 4; i++) {
            statuses.push((await attempt()).status);
        }

        assert.deepEqual(statuses, [400, 400, 400, 429]);
        assert.match((await attempt()).body.message, /Too many attempts/);
        assert.equal((await request(app).get("/api/jobs")).status, 401);   // not rate limited
    });
});
