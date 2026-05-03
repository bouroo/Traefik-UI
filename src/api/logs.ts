import { Hono } from 'hono';
import { config } from '../config';
import { authMiddleware } from '../auth/middleware';
import { logError } from '../lib/logger';
import {
  type AccessLogLine,
  parseCLFLine,
  parseJSONLine,
  isJSONLine,
  applyFilter,
} from './logs-parser';

const logs = new Hono();

logs.use('*', authMiddleware);

// Re-export for use by other modules
export type { AccessLogLine } from './logs-parser';

const AVG_LINE_LENGTH = 256;

async function countFileLines(filePath: string): Promise<number> {
  const file = Bun.file(filePath);
  const stats = await file.stat();
  const fileSize = stats.size;
  if (fileSize === 0) return 0;

  const CHUNK_SIZE = 1024 * 1024;
  let count = 0;
  let pos = 0;

  while (pos < fileSize) {
    const end = Math.min(pos + CHUNK_SIZE, fileSize);
    const buffer = await file.slice(pos, end).bytes();
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] === 0x0a) count++;
    }
    pos = end;
  }

  return count + 1;
}

async function readLastLines(
  filePath: string,
  totalLines: number,
  offset: number = 0
): Promise<{ lines: string[]; totalFileLines: number }> {
  const file = Bun.file(filePath);
  const stats = await file.stat();
  const fileSize = stats.size;

  if (fileSize === 0) {
    return { lines: [], totalFileLines: 0 };
  }

  const totalFileLines = await countFileLines(filePath);

  const neededLines = totalLines + offset;

  let readSize = Math.min(fileSize, neededLines * AVG_LINE_LENGTH + 65536);

  let allLines: string[];

  while (true) {
    const startPos = Math.max(0, fileSize - readSize);
    const content = await file.slice(startPos).text();
    allLines = content.split('\n');

    if (startPos > 0) {
      allLines.shift();
    }

    if (allLines.length > 0 && allLines[allLines.length - 1] === '') {
      allLines.pop();
    }

    if (allLines.length >= neededLines || readSize >= fileSize) {
      break;
    }

    readSize = Math.min(fileSize, readSize * 2);
  }

  const endIdx = allLines.length - offset;
  const startIdx = Math.max(0, endIdx - totalLines);

  return { lines: allLines.slice(startIdx, endIdx), totalFileLines };
}

logs.get('/access', async (c) => {
  const lines = parseInt(c.req.query('lines') || '100');
  const offset = parseInt(c.req.query('offset') || '0');
  const filter = c.req.query('filter') || '';
  const requestedLines = Math.min(Math.max(lines, 1), 1000);

  const logPath = config.paths.accessLog;

  if (!logPath) {
    return c.json(
      { lines: [], totalLines: 0, hasMore: false, message: 'Access log path not configured' },
      404
    );
  }

  if (!(await Bun.file(logPath).exists())) {
    return c.json(
      { lines: [], totalLines: 0, hasMore: false, message: 'Access log file not found' },
      404
    );
  }

  try {
    const { lines: rawLines, totalFileLines } = await readLastLines(
      logPath,
      requestedLines,
      offset
    );

    const parsedLines: AccessLogLine[] = [];
    for (const rawLine of rawLines) {
      const trimmedLine = rawLine.trim();
      if (!trimmedLine) continue;

      let parsed: AccessLogLine | null = null;

      if (isJSONLine(trimmedLine)) {
        parsed = parseJSONLine(trimmedLine);
      } else {
        parsed = parseCLFLine(trimmedLine);
      }

      if (parsed) {
        parsedLines.push(parsed);
      }
    }

    const filteredLines = applyFilter(parsedLines, filter);
    const hasMore = offset + rawLines.length < totalFileLines;

    return c.json({
      lines: filteredLines,
      totalLines: totalFileLines,
      hasMore,
    });
  } catch (error) {
    logError('Error reading access log:', error instanceof Error ? error.message : String(error));
    return c.json(
      { lines: [], totalLines: 0, hasMore: false, message: 'Failed to read access log' },
      500
    );
  }
});

logs.get('/error', async (c) => {
  const _lines = parseInt(c.req.query('lines') || '100');
  const _offset = parseInt(c.req.query('offset') || '0');

  return c.json({
    lines: [],
    totalLines: 0,
    hasMore: false,
    message: 'Error log viewer requires container access — not yet implemented',
    note: 'Configure TRAEFIK_ERROR_LOG_PATH or implement container log integration',
  });
});

export { logs };
