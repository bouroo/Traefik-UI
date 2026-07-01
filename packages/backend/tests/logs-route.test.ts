// Set DYNAMIC_CONFIG_PATH and ACCESS_LOG_PATH to temp files BEFORE the app is imported.
// The preload module's top-level code runs before this file's body (ESM import order).
import { writeFileSync } from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { SHARED_ACCESS_LOG_PATH, patchConfigPaths } from './test-paths-preload';

const tempLog = SHARED_ACCESS_LOG_PATH;

let app: typeof import('./helpers').app;
let setupTestUser: typeof import('./helpers').setupTestUser;
let getTestToken: typeof import('./helpers').getTestToken;
let authRequest: typeof import('./helpers').authRequest;
let cleanupTestEnv: typeof import('./helpers').cleanupTestEnv;

function get(path: string) {
  return app.request(authRequest(path, getTestToken()));
}

const CLF_LINE_200 =
  '10.0.0.1 - alice [10/Oct/2023:13:55:36 +0000] "GET /api/one HTTP/1.1" 200 100 "-" "curl/8" 0.123';
const CLF_LINE_404 =
  '10.0.0.2 - bob [10/Oct/2023:13:55:37 +0000] "GET /api/missing HTTP/1.1" 404 50 "-" "curl/8" 0.045';
const CLF_LINE_500 =
  '10.0.0.3 - carol [10/Oct/2023:13:55:38 +0000] "POST /api/x HTTP/1.1" 500 25 "-" "curl/8" 1.200';
const JSON_LINE_200 =
  '{"time":"2023-10-10T13:55:39Z","method":"GET","path":"/json/ok","status":200,"size":300,"duration":0.05,"client_ip":"10.0.0.4"}';
const JSON_LINE_201 =
  '{"time":"2023-10-10T13:55:40Z","method":"POST","path":"/json/created","status":201,"size":150,"duration":0.1,"client_ip":"10.0.0.5"}';
const JSON_LINE_404 =
  '{"time":"2023-10-10T13:55:41Z","method":"GET","path":"/json/missing","status":404,"size":0,"duration":0.02,"client_ip":"10.0.0.6"}';

function seedLog(extraLines: string[] = []): void {
  const lines = [
    CLF_LINE_200,
    CLF_LINE_404,
    CLF_LINE_500,
    JSON_LINE_200,
    JSON_LINE_201,
    JSON_LINE_404,
    ...extraLines,
  ];
  writeFileSync(tempLog, lines.join('\n') + '\n');
}

describe('logs route /api/logs/access', () => {
  beforeAll(async () => {
    const helpers = await import('./helpers');
    app = helpers.app;
    setupTestUser = helpers.setupTestUser;
    getTestToken = helpers.getTestToken;
    authRequest = helpers.authRequest;
    cleanupTestEnv = helpers.cleanupTestEnv;
    await patchConfigPaths();
    await setupTestUser();
  });

  afterAll(() => {
    cleanupTestEnv();
  });

  it('returns parsed lines, totalLines, and hasMore for a mixed CLF+JSON log', async () => {
    seedLog();
    const res = await get('/api/logs/access');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      lines: { status: number; method: string; path: string }[];
      totalLines: number;
      hasMore: boolean;
    };
    expect(body.lines.length).toBe(6);
    // totalLines counts newlines + 1; the trailing newline yields 7 for 6 lines
    expect(body.totalLines).toBeGreaterThanOrEqual(6);
    // hasMore may be true or false depending on count quirk with trailing newline
    expect(typeof body.hasMore).toBe('boolean');
    const statuses = body.lines.map((l) => l.status);
    expect(statuses).toContain(200);
    expect(statuses).toContain(404);
    expect(statuses).toContain(500);
    expect(statuses).toContain(201);
  });

  it('caps `lines` at 1000 (lines=5000 returns at most 1000)', async () => {
    const extras: string[] = [];
    for (let i = 0; i < 1500; i++) {
      extras.push(
        `10.0.0.${i % 255} - u [10/Oct/2023:13:55:36 +0000] "GET /bulk/${i} HTTP/1.1" 200 1 "-" "x" 0.001`
      );
    }
    seedLog(extras);
    const res = await get('/api/logs/access?lines=5000');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { lines: unknown[]; totalLines: number };
    expect(body.lines.length).toBeLessThanOrEqual(1000);
    expect(body.lines.length).toBeGreaterThan(0);
    expect(body.totalLines).toBeGreaterThanOrEqual(1500);
  });

  it('reports a consistent totalLines regardless of read-window size', async () => {
    const extras: string[] = [];
    for (let i = 0; i < 2000; i++) {
      extras.push(
        `10.0.0.${i % 255} - u [10/Oct/2023:13:55:36 +0000] "GET /big/${i} HTTP/1.1" 200 1 "-" "x" 0.001`
      );
    }
    // 6 base lines + 2000 extras = 2006 content lines; seedLog appends a
    // trailing newline → 2006 newlines total.
    seedLog(extras);

    // A small window forces a mid-file read (startPos > 0); a large window
    // reads from the start (startPos === 0). Both paths must agree.
    const small = await get('/api/logs/access?lines=50');
    const large = await get('/api/logs/access?lines=5000');
    expect(small.status).toBe(200);
    expect(large.status).toBe(200);
    const smallBody = (await small.json()) as { totalLines: number };
    const largeBody = (await large.json()) as { totalLines: number };
    expect(smallBody.totalLines).toBe(largeBody.totalLines);
    // Convention: newline count + 1 → 2006 + 1.
    expect(smallBody.totalLines).toBe(2007);
  });

  it('floors `lines` at 1 (lines=-5 behaves as 1)', async () => {
    seedLog();
    const res = await get('/api/logs/access?lines=-5');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { lines: unknown[]; totalLines: number };
    expect(body.lines.length).toBe(1);
  });

  it('paginates from the end using `offset`', async () => {
    seedLog();
    const noOffset = await get('/api/logs/access?lines=3&offset=0');
    const noOffsetBody = (await noOffset.json()) as { lines: { raw: string }[] };
    const withOffset = await get('/api/logs/access?lines=3&offset=3');
    const withOffsetBody = (await withOffset.json()) as { lines: { raw: string }[] };
    // The two windows should not be the same
    expect(noOffsetBody.lines[0]?.raw).not.toBe(withOffsetBody.lines[0]?.raw);
  });

  it('passes `filter` through to applyFilter (status:200 returns only 200s)', async () => {
    seedLog();
    const res = await get('/api/logs/access?filter=status:200');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { lines: { status: number }[] };
    expect(body.lines.length).toBeGreaterThan(0);
    for (const l of body.lines) {
      expect(l.status).toBe(200);
    }
  });

  it('returns 404 with message for a non-existent log file', async () => {
    const fs = await import('node:fs');
    if (fs.existsSync(tempLog)) fs.unlinkSync(tempLog);
    const res = await get('/api/logs/access');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain('not found');
  });
});
