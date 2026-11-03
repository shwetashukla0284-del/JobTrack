// Loaded before every test file (npm test runs: node --test --require ./tests/env.js).
// Tests never read backend/.env and never touch a real database.
process.env.JWT_SECRET = "test-secret";
process.env.AUTH_RATE_LIMIT = "1000";
process.env.TRUST_PROXY = "0";
delete process.env.CORS_ORIGINS;
delete process.env.MONGO_URI;
