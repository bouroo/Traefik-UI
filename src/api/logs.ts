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

async function readLastLines(
  filePath: string,
  totalLines: number,
  offset: number = 0
): Promise<{ lines: string[]; totalFileLines: number }> {
  const stats = await Bun.file(filePath).stat();
  const fileSize = stats.size;

  if (fileSize === 0) {
    return { lines: [], totalFileLines: 0 };
  }

  const content = await Bun.file(filePath).text();
  const allLines = content.split('\n');
  const totalFileLines = allLines.length;

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
    const hasMore = offset + filteredLines.length < totalFileLines;

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