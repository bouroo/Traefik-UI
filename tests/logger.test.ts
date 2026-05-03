import { describe, it, expect, beforeEach } from 'bun:test';
import { logInfo, logError, logDebug, logWarn, logger, _setLogLevel } from '../src/lib/logger';

describe('logInfo', () => {
  beforeEach(() => _setLogLevel('debug'));

  it('should log info message with timestamp', () => {
    const messages: unknown[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => messages.push(...args);

    try {
      logInfo('test message');
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(messages[0]).toContain('test message');
    } finally {
      console.log = originalLog;
    }
  });

  it('should log info message with additional args', () => {
    const messages: unknown[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => messages.push(...args);

    try {
      logInfo('message', 'arg1', { key: 'value' });
      expect(messages[0]).toContain('message');
      expect(messages[1]).toBe('arg1');
      expect(messages[2]).toEqual({ key: 'value' });
    } finally {
      console.log = originalLog;
    }
  });

  it('should not log when level is silent', () => {
    const messages: unknown[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => messages.push(...args);

    try {
      _setLogLevel('silent');
      logInfo('should not appear');
      expect(messages.length).toBe(0);
    } finally {
      console.log = originalLog;
    }
  });
});

describe('logError', () => {
  beforeEach(() => _setLogLevel('debug'));

  it('should log error message to console.error', () => {
    const messages: unknown[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => messages.push(...args);

    try {
      logError('error occurred');
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(messages[0]).toContain('error occurred');
    } finally {
      console.error = originalError;
    }
  });

  it('should log error with additional args', () => {
    const messages: unknown[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => messages.push(...args);

    try {
      logError('error', 'arg1', 123);
      expect(messages[0]).toContain('error');
      expect(messages[1]).toBe('arg1');
      expect(messages[2]).toBe(123);
    } finally {
      console.error = originalError;
    }
  });

  it('should not log when level is silent', () => {
    const messages: unknown[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => messages.push(...args);

    try {
      _setLogLevel('silent');
      logError('should not appear');
      expect(messages.length).toBe(0);
    } finally {
      console.error = originalError;
    }
  });
});

describe('logDebug', () => {
  beforeEach(() => _setLogLevel('debug'));

  it('should log debug message with DEBUG prefix', () => {
    const messages: unknown[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => messages.push(...args);

    try {
      logDebug('debug info');
      expect(messages[0]).toContain('DEBUG: debug info');
    } finally {
      console.log = originalLog;
    }
  });

  it('should not log when level is info', () => {
    const messages: unknown[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => messages.push(...args);

    try {
      _setLogLevel('info');
      logDebug('should not appear');
      expect(messages.length).toBe(0);
    } finally {
      console.log = originalLog;
    }
  });
});

describe('logWarn', () => {
  beforeEach(() => _setLogLevel('debug'));

  it('should log warn message with WARN prefix', () => {
    const messages: unknown[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => messages.push(...args);

    try {
      logWarn('warning');
      expect(messages[0]).toContain('WARN: warning');
    } finally {
      console.warn = originalWarn;
    }
  });

  it('should not log when level is error', () => {
    const messages: unknown[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => messages.push(...args);

    try {
      _setLogLevel('error');
      logWarn('should not appear');
      expect(messages.length).toBe(0);
    } finally {
      console.warn = originalWarn;
    }
  });
});

describe('logger object', () => {
  beforeEach(() => _setLogLevel('debug'));

  it('should delegate info to logInfo', () => {
    const messages: unknown[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => messages.push(...args);

    try {
      logger.info('delegated info');
      expect(messages[0]).toContain('delegated info');
    } finally {
      console.log = originalLog;
    }
  });

  it('should delegate error to logError', () => {
    const messages: unknown[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => messages.push(...args);

    try {
      logger.error('delegated error');
      expect(messages[0]).toContain('delegated error');
    } finally {
      console.error = originalError;
    }
  });

  it('should delegate debug to logDebug', () => {
    const messages: unknown[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => messages.push(...args);

    try {
      logger.debug('delegated debug');
      expect(messages[0]).toContain('DEBUG: delegated debug');
    } finally {
      console.log = originalLog;
    }
  });

  it('should delegate warn to logWarn', () => {
    const messages: unknown[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => messages.push(...args);

    try {
      logger.warn('delegated warn');
      expect(messages[0]).toContain('WARN: delegated warn');
    } finally {
      console.warn = originalWarn;
    }
  });
});