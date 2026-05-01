// IMPORTANT: env.ts MUST be imported first — it sets process.env before any source module reads config
import './env';
import { startMockTraefik, stopMockTraefik, getMockTraefikUrl } from './mock-traefik';

// Now set the Traefik API URL env var to point to our mock server
// We need to start the mock server first, then set the env var, then import the app
startMockTraefik();
process.env.TRAEFIK_API_URL = getMockTraefikUrl();

// NOW import the app (config.ts will read the env vars we just set)
import { app } from '../src/app';
import { getDb, closeDb, resetDb } from '../src/db';
import { generateToken } from '../src/auth/middleware';

// ---- Test user management ----

const TEST_USER = {
  username: 'testuser',
  password: 'testpass123',
  token: '',
  userId: 0,
};

export async function setupTestUser(): Promise<void> {
  // Reinitialize db if it was closed by previous test suite
  resetDb();
  const db = getDb();

  // Clean any existing test data
  db.run('DELETE FROM users');

  // Create test user
  const passwordHash = await Bun.password.hash(TEST_USER.password, {
    algorithm: 'argon2id',
    timeCost: 1,
    memoryCost: 4096,
  }); // low params for speed
  const result = db.run('INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)', [
    TEST_USER.username,
    passwordHash,
  ]);
  TEST_USER.userId = Number(result.lastInsertRowid || 1);
  TEST_USER.token = generateToken(TEST_USER.userId, TEST_USER.username);
}

export function getTestToken(): string {
  return TEST_USER.token;
}

export function getTestUsername(): string {
  return TEST_USER.username;
}

// ---- Request helpers ----

export function createRequest(path: string, options: RequestInit = {}): Request {
  return new Request(`http://localhost${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    },
  });
}

export function authRequest(path: string, token: string, options: RequestInit = {}): Request {
  return createRequest(path, {
    ...options,
    headers: {
      ...((options.headers as Record<string, string>) || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

// ---- Lifecycle ----

// Only close DB, don't stop mock - other tests may still be using it
export function cleanupTestEnv(): void {
  closeDb();
}

// Full cleanup for final test suite - stops everything
export function fullCleanupTestEnv(): void {
  closeDb();
  stopMockTraefik();
}

export { app, getDb };
