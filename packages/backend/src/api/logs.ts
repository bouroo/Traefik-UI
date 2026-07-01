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

function countNewlines(bytes: Uint8Array): number {
  let count = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0x0a) count++;
  }
  return count;
}

async function countPrefixLines(file: Bun.BunFile, startPos: number): Promise<number> {
  if (startPos <= 0) return 0;

  const CHUNK_SIZE = 1024 * 1024;
  let count = 0;
  let pos = 0;

  while (pos < startPos) {
    const end = Math.min(pos + CHUNK_SIZE, startPos);
    const buffer = await file.slice(pos, end).bytes();
    count += countNewlines(buffer);
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

  const neededLines = totalLines + offset;

  let readSize = Math.min(fileSize, neededLines * AVG_LINE_LENGTH + 65536);

  let allLines: string[];
  let tailBytes!: Uint8Array;
  let tailNewlines!: number;
  const decoder = new TextDecoder();

  let startPos = Math.max(0, fileSize - readSize);

  while (true) {
    tailBytes = await file.slice(startPos).bytes();
    tailNewlines = countNewlines(tailBytes);
    const content = decoder.decode(tailBytes);
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
    startPos = Math.max(0, fileSize - readSize);
  }

  const totalFileLines = await computeTotalFileLines(
    startPos,
    tailNewlines,
    file,
    countPrefixLines
  );

  const endIdx = allLines.length - offset;
  const startIdx = Math.max(0, endIdx - totalLines);

  return { lines: allLines.slice(startIdx, endIdx), totalFileLines };
}

async function computeTotalFileLines(
  startPos: number,
  tailNewlines: number,
  file: Bun.BunFile,
  countPrefix: (file: Bun.BunFile, startPos: number) => Promise<number>
): Promise<number> {
  // Whole-file line-count convention:
  //   - Empty file: 0 lines.
  //   - Non-empty file: newline count + 1 (the unterminated final line).
  // If we read from the beginning, the tail already covers the whole file and
  // we just need to decide whether the file had any content. Otherwise, count
  // the lines in the skipped prefix and add the tail's newline count.
  if (startPos > 0) {
    return (await countPrefix(file, startPos)) + tailNewlines;
  }
  return tailNewlines + 1;
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
