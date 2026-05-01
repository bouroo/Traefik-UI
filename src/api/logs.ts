import { Hono } from 'hono';
import { config } from '../config';
import { authMiddleware } from '../auth/middleware';

const logs = new Hono();

logs.use('*', authMiddleware);

// Log line interface for structured access logs
export interface AccessLogLine {
  timestamp: string;
  method: string;
  path: string;
  protocol: string;
  status: number;
  bodyBytesSent: number;
  requestTime: number;
  remoteAddr: string;
  remoteUser: string;
  httpReferer: string;
  httpUserAgent: string;
  raw: string;
}

// Parse CLF (Common Log Format) lines
// Format: '$remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent" $request_time'
const CLF_REGEX =
  /^(\S+)\s+-\s+(\S+)\s+\[([^\]]+)\]\s+"([^"]+)"\s+(\d+)\s+(\d+)\s+"([^"]*)"\s+"([^"]*)"\s+([\d.]+)/;

function parseCLFLine(line: string): AccessLogLine | null {
  const match = line.match(CLF_REGEX);
  if (!match) return null;

  const [
    ,
    remoteAddr,
    remoteUser,
    timestamp,
    request,
    status,
    bodyBytesSent,
    httpReferer,
    httpUserAgent,
    requestTime,
  ] = match;

  // Parse request line: "METHOD /path HTTP/1.1"
  const requestParts = request.split(' ');
  const method = requestParts[0] || '';
  const path = requestParts[1] || '';
  const protocol = requestParts[2] || '';

  return {
    timestamp,
    method,
    path,
    protocol,
    status: parseInt(status, 10),
    bodyBytesSent: parseInt(bodyBytesSent, 10),
    requestTime: parseFloat(requestTime),
    remoteAddr,
    remoteUser,
    httpReferer: httpReferer || '',
    httpUserAgent: httpUserAgent || '',
    raw: line,
  };
}

// Parse JSON log line (Traefik JSON format)
function parseJSONLine(line: string): AccessLogLine | null {
  try {
    const obj = JSON.parse(line);
    return {
      timestamp: obj.time || obj.Timestamp || new Date().toISOString(),
      method: obj.method || obj.RequestMethod || 'UNKNOWN',
      path: obj.path || obj.RequestPath || obj.url || '/',
      protocol: obj.protocol || obj.RequestProtocol || '',
      status: parseInt(obj.status || obj.ResponseStatus || 0, 10),
      bodyBytesSent: parseInt(obj.size || obj.BodyBytesSent || 0, 10),
      requestTime: parseFloat(obj.duration || obj.RequestDuration || obj.request_time || 0),
      remoteAddr: obj.client_ip || obj.RemoteAddr || obj.clientAddr || '',
      remoteUser: obj.user || obj.remoteUser || '',
      httpReferer: obj.referer || obj.httpReferer || '',
      httpUserAgent: obj.ua || obj.user_agent || obj.httpUserAgent || '',
      raw: line,
    };
  } catch {
    return null;
  }
}

// Detect if a line is JSON (starts with '{')
function isJSONLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('{');
}

// Read last N lines from a file efficiently
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

  // For efficiency with large files, read from the end
  // Use a buffer approach: read chunks until we have enough lines
  const avgLineLength = 200; //预估平均行长度
  const bufferSize = Math.min(fileSize, totalLines * avgLineLength * 2 + 65536);
  const startPos = Math.max(0, fileSize - bufferSize);

  const fullContent = await Bun.file(filePath).text();
  const buffer = fullContent.slice(startPos);
  const allLines = buffer.split('\n');

  // If we started from the middle, the first line might be incomplete
  // Prepend a newline to handle this
  const rawLines = startPos > 0 ? ['', ...allLines] : allLines;

  // Count total lines from the full content (single read, no second I/O)
  let totalFileLines = 0;
  for (const char of fullContent) {
    if (char === '\n') totalFileLines++;
  }

  // Calculate start index considering offset
  const startIndex = Math.max(0, rawLines.length - totalLines - offset);

  // Get the requested range of lines
  const requestedLines = rawLines.slice(startIndex, startIndex + totalLines + offset).slice(offset);

  return { lines: requestedLines, totalFileLines };
}

// Filter lines based on filter query
function applyFilter(lines: AccessLogLine[], filter: string): AccessLogLine[] {
  if (!filter) return lines;

  // Parse simple filter patterns: status:5xx, method:GET, path:/api
  const parts = filter.split(':');
  if (parts.length !== 2) return lines;

  const [, value] = parts;
  const field = parts[0].toLowerCase();

  switch (field) {
    case 'status':
      // Support status:5xx, status:404
      if (value.endsWith('xx')) {
        const prefix = value.charAt(0);
        return lines.filter((line) => {
          const statusStr = line.status.toString();
          return statusStr.charAt(0) === prefix;
        });
      }
      return lines.filter((line) => line.status.toString() === value);

    case 'method':
      return lines.filter((line) => line.method.toLowerCase() === value.toLowerCase());

    case 'path':
      return lines.filter((line) => line.path.includes(value));

    default:
      return lines;
  }
}

// GET /api/logs/access
// Query params: ?lines=100&offset=0&filter=status:5xx
// Reads the last N lines from Traefik access log file
// Traefik access logs are in Common Log Format (CLF) or JSON format (configured)
// Returns: { lines: [{ timestamp, method, path, status, duration, clientIp, ... }], totalLines, hasMore }
logs.get('/access', async (c) => {
  const lines = parseInt(c.req.query('lines') || '100');
  const offset = parseInt(c.req.query('offset') || '0');
  const filter = c.req.query('filter') || '';
  const requestedLines = Math.min(Math.max(lines, 1), 1000); // Clamp between 1 and 1000

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

    // Parse each line
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

    // Apply filter if specified
    const filteredLines = applyFilter(parsedLines, filter);

    // Calculate hasMore
    const hasMore = offset + filteredLines.length < totalFileLines;

    return c.json({
      lines: filteredLines,
      totalLines: totalFileLines,
      hasMore,
    });
  } catch (error) {
    console.error(
      `[logs] Error reading access log:`,
      error instanceof Error ? error.message : String(error)
    );
    return c.json(
      { lines: [], totalLines: 0, hasMore: false, message: 'Failed to read access log' },
      500
    );
  }
});

// GET /api/logs/error
// Query params: ?lines=100&offset=0
// Returns error logs (placeholder - would require container log access)
logs.get('/error', async (c) => {
  const _lines = parseInt(c.req.query('lines') || '100');
  const _offset = parseInt(c.req.query('offset') || '0');

  // For now, return a placeholder message
  // In a full implementation, this would read from Docker/Podman container logs
  // or a configured error log file path
  return c.json({
    lines: [],
    totalLines: 0,
    hasMore: false,
    message: 'Error log viewer requires container access — not yet implemented',
    note: 'Configure TRAEFIK_ERROR_LOG_PATH or implement container log integration',
  });
});

export { logs };
