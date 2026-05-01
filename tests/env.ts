// Set environment variables for testing BEFORE any source module is imported.
// This file must be imported first in any test setup.

process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-jwt-secret-for-integration-tests';
process.env.LOG_LEVEL = 'silent';
process.env.PORT = '0'; // random port
process.env.HOST = '127.0.0.1';
process.env.CORS_ORIGIN = '*';
// ACME and access log paths — empty for tests (no file access)
process.env.ACME_JSON_PATH = '';
process.env.ACCESS_LOG_PATH = '';
