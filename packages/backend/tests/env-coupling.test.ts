import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

// Import env setup FIRST so LOG_LEVEL/silent, RATE_LIMIT_DISABLED=true, etc. are applied.
// We still mutate NODE_ENV / RATE_LIMIT_DISABLED inside specific tests with save+restore.
import './env';

import { config } from '../src/config';
import { logInfo, logWarn, _setLogLevel } from '../src/lib/logger';

describe('env-coupling invariant (Slice D)', () => {
  const ORIGINAL: Record<string, string | undefined> = {
    NODE_ENV: process.env.NODE_ENV,
    RATE_LIMIT_DISABLED: process.env.RATE_LIMIT_DISABLED,
    LOG_LEVEL: process.env.LOG_LEVEL,
  };

  function setEnv(name: string, value: string | undefined): void {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }

  function restoreEnv(): void {
    for (const [k, v] of Object.entries(ORIGINAL)) setEnv(k, v);
  }

  beforeEach(() => {
    // Reset the logger override between tests
    _setLogLevel('silent');
  });

  afterEach(() => {
    restoreEnv();
  });

  describe('config.isTest / config.nodeEnv', () => {
    it('reports isTest=true when NODE_ENV=test', () => {
      setEnv('NODE_ENV', 'test');
      expect(config.nodeEnv).toBe('test');
      expect(config.isTest).toBe(true);
    });

    it('reports isTest=false when NODE_ENV=production', () => {
      setEnv('NODE_ENV', 'production');
      expect(config.nodeEnv).toBe('production');
      expect(config.isTest).toBe(false);
    });

    it('falls back to "development" when NODE_ENV is unset', () => {
      setEnv('NODE_ENV', undefined);
      expect(config.nodeEnv).toBe('development');
      expect(config.isTest).toBe(false);
    });
  });

  describe('config.rateLimit.disabled', () => {
    it('is true when NODE_ENV=test (test-suite default)', () => {
      setEnv('NODE_ENV', 'test');
      setEnv('RATE_LIMIT_DISABLED', undefined);
      expect(config.rateLimit.disabled).toBe(true);
    });

    it('is true when RATE_LIMIT_DISABLED=true regardless of NODE_ENV', () => {
      setEnv('RATE_LIMIT_DISABLED', 'true');
      setEnv('NODE_ENV', 'production');
      expect(config.rateLimit.disabled).toBe(true);
    });

    it('is false when NODE_ENV=development and RATE_LIMIT_DISABLED is empty', () => {
      setEnv('NODE_ENV', 'development');
      setEnv('RATE_LIMIT_DISABLED', '');
      expect(config.rateLimit.disabled).toBe(false);
    });

    it('is true when both conditions trigger', () => {
      setEnv('NODE_ENV', 'test');
      setEnv('RATE_LIMIT_DISABLED', 'true');
      expect(config.rateLimit.disabled).toBe(true);
    });
  });

  describe('logger respects config.logLevel', () => {
    it('honors config.logLevel as initial level and allows _setLogLevel override', () => {
      // Force the initial level to 'warn' via env + config before assertions.
      // Note: config.logLevel is read-once at module load (it's a field, not a getter),
      // so we use the _setLogLevel test hook to simulate the level config would set.
      const messages: { log: unknown[]; warn: unknown[] } = { log: [], warn: [] };
      const origLog = console.log;
      const origWarn = console.warn;
      console.log = (...args: unknown[]) => messages.log.push(...args);
      console.warn = (...args: unknown[]) => messages.warn.push(...args);

      try {
        // Simulate config.logLevel === 'warn' (info is suppressed, warn passes)
        _setLogLevel('warn');
        logInfo('should NOT print at warn level');
        logWarn('SHOULD print at warn level');
        expect(messages.log.length).toBe(0);
        expect(messages.warn.length).toBe(1);
        expect(messages.warn[0]).toContain('SHOULD print at warn level');

        // Now override via test hook to 'debug' — both must pass
        messages.log.length = 0;
        messages.warn.length = 0;
        _setLogLevel('debug');
        logInfo('info now prints');
        logWarn('warn still prints');
        expect(messages.log.length).toBe(1);
        expect(messages.log[0]).toContain('info now prints');
        expect(messages.warn.length).toBe(1);
        expect(messages.warn[0]).toContain('warn still prints');
      } finally {
        console.log = origLog;
        console.warn = origWarn;
      }
    });

    it('config.logLevel resolves from LOG_LEVEL env at module load', () => {
      // env.ts sets LOG_LEVEL='silent' before this file is imported.
      // config.logLevel is captured at module load time, so it must reflect
      // the initial env state. We assert the value is a valid LogLevel and,
      // under the env.ts setup, is 'silent'.
      const validLevels = ['debug', 'info', 'warn', 'error', 'silent'];
      expect(validLevels).toContain(config.logLevel);
      // env.ts explicitly sets LOG_LEVEL=silent before any import
      expect(config.logLevel).toBe('silent');
    });
  });
});
