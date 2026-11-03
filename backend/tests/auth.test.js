const { describe, test, before, after, afterEach, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../app");
const User = require("../models/user");
const { startDb, clearDb, stopDb } = require("./helpers");

before(startDb);
afterEach(clearDb);
after(stopDb);

const register = (body) => request(app).post("/api/auth/register").send(body);
const login = (body) => request(app).post("/api/auth/login").send(body);

describe("POST /api/auth/register", () => {
    const invalid = [
        ["missing name", { email: "a@b.com", password: "secret123" }],
        ["missing password", { name: "A", email: "a@b.com" }],
        ["invalid email", { name: "A", email: "not-an-email", password: "secret123" }],
        ["password too short", { name: "A", email: "a@b.com", password: "12345" }],
        ["password over 72 bytes", { name: "A", email: "a@b.com", password: "x".repeat(73) }],
        ["non-string password", { name: "A", email: "a@b.com", password: 12345678 }]
    ];

    for (const [name, body] of invalid) {
        test(`rejects ${name} with 400`, async () => {
            const response = await register(body);

            assert.equal(response.status, 400);
            assert.equal(typeof response.body.message, "string");
        });
    }

    test("creates a user with a normalised email and never returns the password", async () => {
        const response = await register({ name: " Asha ", email: " Asha@Example.COM ", password: "secret123" });

        assert.equal(response.status, 201);
        assert.deepEqual(Object.keys(response.body.user).sort(), ["email", "id", "name"]);
        assert.equal(response.body.user.name, "Asha");
        assert.equal(response.body.user.email, "asha@example.com");
        assert.doesNotMatch(JSON.stringify(response.body), /password|\$2[aby]\$/);

        const saved = await User.findOne({ email: "asha@example.com" });
        assert.notEqual(saved.password, "secret123");   // stored as a bcrypt hash
    });

    test("rejects a duplicate email, including different capitalisation", async () => {
        await register({ name: "A", email: "a@b.com", password: "secret123" }).expect(201);

        const response = await register({ name: "B", email: "A@B.com", password: "secret123" });

        assert.equal(response.status, 400);
        assert.equal(response.body.message, "User already exists");
    });

    test("two simultaneous sign-ups with the same email: one succeeds, one gets 400 (not 500)", async () => {
        const body = { name: "A", email: "race@b.com", password: "secret123" };
        const responses = await Promise.all([register(body), register(body)]);

        assert.deepEqual(responses.map((response) => response.status).sort(), [201, 400]);
    });
});

describe("POST /api/auth/login", () => {
    beforeEach(() => register({ name: "A", email: "a@b.com", password: "secret123" }).expect(201));

    test("returns a token for correct credentials (email is case-insensitive)", async () => {
        const response = await login({ email: "A@B.COM", password: "secret123" });

        assert.equal(response.status, 200);
        assert.equal(typeof response.body.token, "string");
        assert.equal(response.body.user.email, "a@b.com");
    });

    for (const [name, body] of [
        ["wrong password", { email: "a@b.com", password: "wrong-one" }],
        ["unknown email", { email: "nobody@b.com", password: "secret123" }]
    ]) {
        test(`returns the same 401 message for ${name}`, async () => {
            const response = await login(body);

            assert.equal(response.status, 401);
            assert.equal(response.body.message, "Invalid email or password");
        });
    }

    test("rejects missing fields with 400", async () => {
        assert.equal((await login({ email: "a@b.com" })).status, 400);
    });
});
