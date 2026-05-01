// Set environment variables for integration testing BEFORE any source module is imported.
// This file must be imported FIRST in any integration test setup.
// (Separate from helpers.ts because ES module imports are hoisted above the module body)

process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-jwt-secret-for-integration-tests';
process.env.LOG_LEVEL = 'silent';
process.env.PORT = '0';
process.env.HOST = '127.0.0.1';
process.env.CORS_ORIGIN = '*';
process.env.ACME_JSON_PATH = '';
process.env.ACCESS_LOG_PATH = '';
