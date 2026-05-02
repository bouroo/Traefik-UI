type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

function getLevel(): LogLevel {
  const env = Bun.env.LOG_LEVEL?.toLowerCase() || 'info';
  if (env === 'debug') return 'debug';
  if (env === 'silent') return 'silent';
  return 'info';
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[getLevel()];
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

export function logInfo(message: string, ...args: unknown[]): void {
  if (shouldLog('info')) {
    console.log(`[${formatTimestamp()}] ${message}`, ...args);
  }
}

export function logError(message: string, ...args: unknown[]): void {
  if (shouldLog('error')) {
    console.error(`[${formatTimestamp()}] ${message}`, ...args);
  }
}

export function logDebug(message: string, ...args: unknown[]): void {
  if (shouldLog('debug')) {
    console.log(`[${formatTimestamp()}] DEBUG: ${message}`, ...args);
  }
}

export function logWarn(message: string, ...args: unknown[]): void {
  if (shouldLog('warn')) {
    console.warn(`[${formatTimestamp()}] WARN: ${message}`, ...args);
  }
}

export const logger = {
  info: logInfo,
  error: logError,
  debug: logDebug,
  warn: logWarn,
};