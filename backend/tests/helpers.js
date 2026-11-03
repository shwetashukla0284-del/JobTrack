// Shared test helpers: a temporary in-memory MongoDB per test file.

const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

const User = require("../models/user");
const Job = require("../models/job");

let server;

const startDb = async () => {
    // Generous start-up time: slow or busy machines (and CI) can take a while
    server = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
    await mongoose.connect(server.getUri());
    // Make sure the unique email index exists before tests rely on it
    await Promise.all([User.init(), Job.init()]);
};

const clearDb = async () => {
    const collections = Object.values(mongoose.connection.collections);
    await Promise.all(collections.map((collection) => collection.deleteMany({})));
};

const stopDb = async () => {
    await mongoose.disconnect();
    await server.stop();
};

const dbUri = () => server.getUri();

let userCounter = 0;

// Registers a fresh user and returns { token, userId }
const createUser = async (app) => {
    userCounter += 1;
    const email = `user${userCounter}@test.com`;

    await request(app)
        .post("/api/auth/register")
        .send({ name: "Test User", email, password: "secret123" })
        .expect(201);

    const login = await request(app)
        .post("/api/auth/login")
        .send({ email, password: "secret123" })
        .expect(200);

    return { token: login.body.token, userId: login.body.user.id };
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

// Every key in `expected` must equal the same key in `actual`
// (other keys in `actual` are ignored)
const assertIncludes = (actual, expected) => {
    for (const [key, value] of Object.entries(expected)) {
        assert.deepStrictEqual(actual[key], value, `"${key}"`);
    }
};

module.exports = {
    assertIncludes,
    startDb,
    clearDb,
    stopDb,
    dbUri,
    createUser,
    auth
};
