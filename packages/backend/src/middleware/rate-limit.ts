import type { Context, MiddlewareHandler, Next } from 'hono';
import { logWarn } from '../lib/logger';

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  keyGenerator?: (c: Context) => string;
  disabled?: boolean;
}

interface BucketEntry {
  timestamps: number[];
}

const DEFAULTS: Required<Pick<RateLimitOptions, 'windowMs' | 'max'>> = {
  windowMs: 60_000,
  max: 100,
};

const buckets = new Map<string, BucketEntry>();

let cleanupTimer: ReturnType<typeof setInterval> | null = null;
let lastWindowMs = 0;

function defaultKey(c: Context): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'unknown'
  );
}

function cleanupExpired(windowMs: number): void {
  const now = Date.now();
  const cutoff = now - windowMs;
  for (const [key, entry] of buckets) {
    while (entry.timestamps.length > 0 && entry.timestamps[0] <= cutoff) {
      entry.timestamps.shift();
    }
    if (entry.timestamps.length === 0) {
      buckets.delete(key);
    }
  }
}

function ensureCleanup(windowMs: number): void {
  if (cleanupTimer && lastWindowMs === windowMs) return;
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
  }
  lastWindowMs = windowMs;
  const interval = Math.max(windowMs, 30_000);
  cleanupTimer = setInterval(() => cleanupExpired(windowMs), interval);
  // Don't keep the process alive solely for cleanup
  if (typeof cleanupTimer === 'object' && cleanupTimer && 'unref' in cleanupTimer) {
    (cleanupTimer as unknown as { unref: () => void }).unref();
  }
}

export function rateLimit(options: RateLimitOptions = {}): MiddlewareHandler {
  const windowMs = options.windowMs ?? DEFAULTS.windowMs;
  const max = options.max ?? DEFAULTS.max;
  const keyGenerator = options.keyGenerator ?? defaultKey;
  const disabled = options.disabled ?? false;

  if (disabled) {
    return async (_c: Context, next: Next) => {
      await next();
    };
  }

  ensureCleanup(windowMs);

  return async (c: Context, next: Next) => {
    const key = keyGenerator(c);
    const now = Date.now();
    const cutoff = now - windowMs;

    let entry = buckets.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      buckets.set(key, entry);
    }

    while (entry.timestamps.length > 0 && entry.timestamps[0] <= cutoff) {
      entry.timestamps.shift();
    }

    if (entry.timestamps.length >= max) {
      const oldest = entry.timestamps[0];
      const resetAt = oldest + windowMs;
      const retryAfter = Math.max(1, Math.ceil((resetAt - now) / 1000));
      const remaining = 0;

      c.header('X-RateLimit-Limit', String(max));
      c.header('X-RateLimit-Remaining', String(remaining));
      c.header('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
      c.header('Retry-After', String(retryAfter));

      logWarn(`Rate limit exceeded for ${key} on ${c.req.method} ${c.req.path}`);

      return c.json({ error: 'Too many requests', retryAfter }, 429);
    }

    entry.timestamps.push(now);
    const remaining = max - entry.timestamps.length;
    const resetAt = entry.timestamps[0] + windowMs;

    c.header('X-RateLimit-Limit', String(max));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));

    await next();
  };
}

/** @internal Test-only hook to reset state between runs */
export function _resetRateLimitState(): void {
  buckets.clear();
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
  lastWindowMs = 0;
}
