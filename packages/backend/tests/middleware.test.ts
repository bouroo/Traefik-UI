import { describe, it, expect, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { rateLimit, _resetRateLimitState } from '../src/middleware/rate-limit';
import { securityHeaders } from '../src/middleware/security-headers';
import { validateBody, validateData } from '../src/middleware/validate';
import type { ValidationSchema } from '../src/middleware/validate';
import { setupTestUser, createRequest } from './helpers';

describe('rateLimit middleware', () => {
  beforeEach(() => {
    _resetRateLimitState();
  });

  it('allows requests under the limit and sets rate-limit headers', async () => {
    const app = new Hono();
    app.use('/test', rateLimit({ windowMs: 60_000, max: 5 }));
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('http://localhost/test');
    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('4');
    expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy();
  });

  it('returns 429 with retryAfter when limit is exceeded', async () => {
    const app = new Hono();
    app.use('/test', rateLimit({ windowMs: 60_000, max: 2 }));
    app.get('/test', (c) => c.json({ ok: true }));

    await app.request('http://localhost/test');
    await app.request('http://localhost/test');
    const res = await app.request('http://localhost/test');

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('Too many requests');
    expect(typeof body.retryAfter).toBe('number');
    expect(body.retryAfter).toBeGreaterThan(0);
    expect(res.headers.get('Retry-After')).toBeTruthy();
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('does nothing when disabled', async () => {
    const app = new Hono();
    app.use('/test', rateLimit({ windowMs: 60_000, max: 1, disabled: true }));
    app.get('/test', (c) => c.json({ ok: true }));

    await app.request('http://localhost/test');
    const res = await app.request('http://localhost/test');
    expect(res.status).toBe(200);
  });
});

describe('validateData', () => {
  const schema: ValidationSchema = {
    name: { type: 'string', required: true, minLength: 1 },
    age: { type: 'number', min: 0, max: 150 },
    tags: { type: 'array', required: false },
  };

  it('passes valid data', () => {
    const r = validateData({ name: 'alice', age: 30, tags: ['a', 'b'] }, schema);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('rejects missing required field', () => {
    const r = validateData({ age: 30 }, schema);
    expect(r.valid).toBe(false);
    expect(r.errors[0].field).toBe('name');
  });

  it('rejects wrong type', () => {
    const r = validateData({ name: 123 }, schema);
    expect(r.valid).toBe(false);
    expect(r.errors[0].field).toBe('name');
    expect(r.errors[0].message).toContain('string');
  });

  it('rejects out-of-range numbers', () => {
    const r = validateData({ name: 'bob', age: 200 }, schema);
    expect(r.valid).toBe(false);
    expect(r.errors[0].field).toBe('age');
  });

  it('rejects non-object bodies', () => {
    const r = validateData('not an object', schema);
    expect(r.valid).toBe(false);
    expect(r.errors[0].field).toBe('body');
  });
});

describe('validateBody middleware', () => {
  const schema: ValidationSchema = {
    username: { type: 'string', required: true, minLength: 1 },
  };

  const buildApp = () => {
    const app = new Hono();
    app.post('/test', validateBody(schema), (c) => c.json({ ok: true }));
    return app;
  };

  it('returns 400 with details on invalid body', async () => {
    const app = buildApp();
    const res = await app.request('http://localhost/test', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
    expect(Array.isArray(body.details)).toBe(true);
    expect(body.details[0].field).toBe('username');
  });

  it('returns 400 when JSON is malformed', async () => {
    const app = buildApp();
    const res = await app.request('http://localhost/test', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(400);
  });

  it('passes through on valid body', async () => {
    const app = buildApp();
    const res = await app.request('http://localhost/test', {
      method: 'POST',
      body: JSON.stringify({ username: 'alice' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(200);
  });
});

describe('securityHeaders middleware', () => {
  beforeEach(async () => {
    await setupTestUser();
  });

  it('sets baseline security headers on responses', async () => {
    const app = new Hono();
    app.use('*', securityHeaders());
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('http://localhost/test');
    expect(res.status).toBe(200);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('x-xss-protection')).toBe('0');
    expect(res.headers.get('permissions-policy')).toBe('geolocation=(), microphone=(), camera=()');
  });

  it('omits HSTS header by default', async () => {
    const app = new Hono();
    app.use('*', securityHeaders());
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('http://localhost/test');
    expect(res.headers.get('strict-transport-security')).toBeNull();
  });

  it('sets HSTS header when config.security.hsts is true', async () => {
    const { config } = await import('../src/config');
    const original = config.security.hsts;
    Object.defineProperty(config.security, 'hsts', { value: true, configurable: true });

    try {
      const app = new Hono();
      app.use('*', securityHeaders());
      app.get('/test', (c) => c.json({ ok: true }));

      const res = await app.request('http://localhost/test');
      expect(res.headers.get('strict-transport-security')).toBe(
        'max-age=31536000; includeSubDomains'
      );
    } finally {
      Object.defineProperty(config.security, 'hsts', { value: original, configurable: true });
    }
  });

  it('sets security headers on the /api/health endpoint via the app', async () => {
    const { app } = await import('./helpers');
    const res = await app.request(createRequest('/api/health'));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  });
});
