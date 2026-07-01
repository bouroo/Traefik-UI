import { describe, it, expect, beforeEach, afterAll } from 'bun:test';
import { Hono } from 'hono';
import { logAudit } from '../src/lib/audit';
import type { Context } from 'hono';
import { getDb, resetDb } from '../src/db';
import { setupTestUser, cleanupTestEnv } from './helpers';

interface BuildOpts {
  userId?: number;
  xForwardedFor?: string;
}

async function buildCapturedCtx(opts: BuildOpts = {}): Promise<Context> {
  const headers: Record<string, string> = {};
  if (opts.xForwardedFor !== undefined) {
    headers['x-forwarded-for'] = opts.xForwardedFor;
  }
  const req = new Request('http://localhost/test', { headers });
  const app = new Hono();
  let captured: Context | undefined;
  app.use('*', async (c, next) => {
    if (opts.userId !== undefined) c.set('userId', opts.userId);
    await next();
  });
  app.get('/test', async (c) => {
    captured = c;
    return c.json({ ok: true });
  });
  const res = await app.fetch(req, { method: 'GET' });
  void res;
  if (!captured) throw new Error('Failed to capture context');
  return captured;
}

describe('audit logAudit', () => {
  beforeEach(async () => {
    resetDb();
    await setupTestUser();
  });

  afterAll(() => {
    cleanupTestEnv();
  });

  it('inserts a row with userId, action, resource, resourceId, details, and ip_address', async () => {
    const c = await buildCapturedCtx({ userId: 42, xForwardedFor: '203.0.113.5' });
    logAudit(c, 'user.create', 'user', 'user-123', '{"name":"alice"}');

    const db = getDb();
    const row = db
      .query(
        'SELECT user_id, action, resource, resource_id, details, ip_address FROM audit_logs ORDER BY id DESC LIMIT 1'
      )
      .get() as
      | {
          user_id: number;
          action: string;
          resource: string;
          resource_id: string;
          details: string;
          ip_address: string;
        }
      | undefined;

    expect(row).toBeDefined();
    expect(row!.user_id).toBe(42);
    expect(row!.action).toBe('user.create');
    expect(row!.resource).toBe('user');
    expect(row!.resource_id).toBe('user-123');
    expect(row!.details).toBe('{"name":"alice"}');
    expect(row!.ip_address).toBe('203.0.113.5');
  });

  it('defaults resourceId to null when omitted', async () => {
    const c = await buildCapturedCtx({ userId: 7, xForwardedFor: '10.0.0.1' });
    logAudit(c, 'config.read', 'config');

    const db = getDb();
    const row = db
      .query('SELECT resource_id, details FROM audit_logs ORDER BY id DESC LIMIT 1')
      .get() as { resource_id: string | null; details: string | null } | undefined;

    expect(row).toBeDefined();
    expect(row!.resource_id).toBeNull();
    expect(row!.details).toBeNull();
  });

  it('falls back ip_address to "unknown" when x-forwarded-for is absent', async () => {
    const c = await buildCapturedCtx({ userId: 1 });
    logAudit(c, 'login', 'auth');

    const db = getDb();
    const row = db.query('SELECT ip_address FROM audit_logs ORDER BY id DESC LIMIT 1').get() as
      | { ip_address: string }
      | undefined;

    expect(row).toBeDefined();
    expect(row!.ip_address).toBe('unknown');
  });

  it('stores null userId when context has no userId', async () => {
    const c = await buildCapturedCtx({ xForwardedFor: '1.2.3.4' });
    logAudit(c, 'system.event', 'system');

    const db = getDb();
    const row = db.query('SELECT user_id FROM audit_logs ORDER BY id DESC LIMIT 1').get() as
      | { user_id: number | null }
      | undefined;

    expect(row).toBeDefined();
    expect(row!.user_id).toBeNull();
  });

  it('does not throw when the DB insert fails (CURRENTLY FAILS — bug to fix in slice C3)', async () => {
    const c = await buildCapturedCtx({ userId: 1, xForwardedFor: '5.6.7.8' });

    // Force the underlying db.run to throw by monkey-patching it
    const db = getDb();
    const originalRun = db.run.bind(db);
    (db as unknown as { run: typeof db.run }).run = (() => {
      throw new Error('simulated DB failure');
    }) as typeof db.run;

    try {
      let threw = false;
      try {
        logAudit(c, 'should.not.throw', 'test');
      } catch {
        threw = true;
      }
      expect(threw).toBe(false);
    } finally {
      (db as unknown as { run: typeof db.run }).run = originalRun;
    }
  });
});
