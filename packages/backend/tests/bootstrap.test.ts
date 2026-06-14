import { describe, it, expect, afterEach, afterAll } from 'bun:test';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDb, closeDb, resetDb } from '../src/db';

// Re-importing the env setup must happen before schema import side effects.
import './env';

const TEMP_DB = resolve('./data/test-bootstrap-env.db');
const TEMP_DB_WAL = `${TEMP_DB}-wal`;
const TEMP_DB_SHM = `${TEMP_DB}-shm`;
const TEMP_DB_JOURNAL = `${TEMP_DB}-journal`;

function cleanupTempDb(): void {
  for (const p of [TEMP_DB, TEMP_DB_WAL, TEMP_DB_SHM, TEMP_DB_JOURNAL]) {
    try {
      if (existsSync(p)) rmSync(p);
    } catch {
      // ignore
    }
  }
}

const ORIGINAL_ENV: Record<string, string | undefined> = {
  DB_PATH: process.env.DB_PATH,
  ADMIN_USERNAME: process.env.ADMIN_USERNAME,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
};

function setEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function restoreEnv(): void {
  for (const [k, v] of Object.entries(ORIGINAL_ENV)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe('First-run bootstrap (Slice A)', () => {
  afterEach(() => {
    closeDb();
    cleanupTempDb();
    restoreEnv();
  });

  afterAll(() => {
    closeDb();
    cleanupTempDb();
  });

  it('(a) uses ADMIN_PASSWORD env var when set: admin authenticates with it', async () => {
    // Arrange: fresh DB at temp path with ADMIN_PASSWORD set before init
    setEnv('DB_PATH', TEMP_DB);
    setEnv('ADMIN_USERNAME', 'envadmin');
    const envPassword = 'Sup3rSecret!FromEnv42';
    setEnv('ADMIN_PASSWORD', envPassword);

    // Act
    resetDb();
    const db = getDb();

    // Assert: row exists with the env-provided username
    const row = db
      .query('SELECT username, password_hash FROM users WHERE username = ?')
      .get('envadmin') as { username: string; password_hash: string } | undefined;
    expect(row).toBeDefined();
    expect(row?.username).toBe('envadmin');

    // Assert: hash verifies with the env password
    const verified = await Bun.password.verify(envPassword, row!.password_hash);
    expect(verified).toBe(true);
  });

  it('(b) generates a random password when ADMIN_PASSWORD is unset: admin authenticates with captured stdout password', async () => {
    setEnv('DB_PATH', TEMP_DB);
    setEnv('ADMIN_USERNAME', 'admin');
    setEnv('ADMIN_PASSWORD', '');

    // Spy on console.log to capture the bootstrap banner.
    // We also spy on console.error / console.warn to assert no leak via
    // structured-logger-style lines (those also flow through console.* in Bun).
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];
    const origLog = console.log;
    const origError = console.error;
    const origWarn = console.warn;
    console.log = (...args: unknown[]) => {
      stdoutLines.push(args.map(String).join(' '));
    };
    console.error = (...args: unknown[]) => {
      stderrLines.push(args.map(String).join(' '));
    };
    console.warn = (...args: unknown[]) => {
      stderrLines.push(args.map(String).join(' '));
    };

    try {
      resetDb();
      const db = getDb();

      // Verify an admin user was created
      const row = db.query('SELECT username, password_hash FROM users LIMIT 1').get() as
        | { username: string; password_hash: string }
        | undefined;
      expect(row).toBeDefined();

      // Parse the banner to extract the generated password
      const banner = stdoutLines.join('\n');
      // Banner format includes: " Password:  <value>"
      const match = banner.match(/Password:\s+(\S+)/);
      expect(match).not.toBeNull();
      const generatedPassword = match![1];
      expect(generatedPassword.length).toBeGreaterThanOrEqual(12);

      // The hash in the DB must verify with the captured password
      const verified = await Bun.password.verify(generatedPassword, row!.password_hash);
      expect(verified).toBe(true);

      // Security assertion: the generated password must NOT appear in any
      // structured-logger-style line (i.e. anything printed via console.log /
      // console.error / console.warn AFTER the banner that contains the
      // timestamp prefix used by logInfo/logWarn/logError).
      // The banner itself uses console.log directly — that is the one allowed place.
      // The only [timestamp] prefixed line that should be present is the "First run"
      // announcement which must NOT contain the password.
      const tsPrefixed = stdoutLines
        .concat(stderrLines)
        .filter((l) => /^\[\d{4}-\d{2}-\d{2}T/.test(l));
      for (const line of tsPrefixed) {
        expect(line).not.toContain(generatedPassword);
      }
    } finally {
      console.log = origLog;
      console.error = origError;
      console.warn = origWarn;
    }
  });

  it('(c) does not write admin-credentials.txt during bootstrap', async () => {
    setEnv('DB_PATH', TEMP_DB);
    setEnv('ADMIN_USERNAME', 'admin');
    setEnv('ADMIN_PASSWORD', '');

    // The legacy creds file is a global path (./data/admin-credentials.txt).
    // A pre-existing file from prior runs must not be confused with one
    // created by THIS bootstrap. Snapshot mtime, run bootstrap, assert the
    // file was not (re)created or modified.
    const credsFile = resolve('./data/admin-credentials.txt');
    const hadFile = existsSync(credsFile);
    if (hadFile) {
      // Clear it so we can detect a re-creation.
      rmSync(credsFile);
    }

    resetDb();
    getDb();

    if (hadFile) {
      // If the file existed before but bootstrap did NOT touch it,
      // it should still be absent. The new bootstrap must not write it.
      expect(existsSync(credsFile)).toBe(false);
    } else {
      expect(existsSync(credsFile)).toBe(false);
    }
  });

  it('(d) ADMIN_USERNAME env var controls the created admin username', async () => {
    setEnv('DB_PATH', TEMP_DB);
    setEnv('ADMIN_USERNAME', 'rootadmin');
    setEnv('ADMIN_PASSWORD', 'AnotherP@ss123');

    resetDb();
    const db = getDb();

    const row = db.query('SELECT username FROM users WHERE username = ?').get('rootadmin') as
      | { username: string }
      | undefined;
    expect(row).toBeDefined();
    expect(row?.username).toBe('rootadmin');

    // Also confirm no default 'admin' user was created in this scenario
    const adminRow = db.query('SELECT username FROM users WHERE username = ?').get('admin') as
      | { username: string }
      | undefined;
    expect(adminRow).toBeNull();
  });
});
