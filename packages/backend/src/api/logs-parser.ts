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
export const CLF_REGEX =
  /^(\S+)\s+-\s+(\S+)\s+\[([^\]]+)\]\s+"([^"]+)"\s+(\d+)\s+(\d+)\s+"([^"]*)"\s+"([^"]*)"\s+([\d.]+)/;

export function parseCLFLine(line: string): AccessLogLine | null {
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

export function parseJSONLine(line: string): AccessLogLine | null {
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

export function isJSONLine(line: string): boolean {
  return line.startsWith('{');
}

export function applyFilter(lines: AccessLogLine[], filter: string): AccessLogLine[] {
  if (!filter) return lines;

  const colonIdx = filter.indexOf(':');
  if (colonIdx === -1) return lines;

  const field = filter.slice(0, colonIdx).toLowerCase();
  const value = filter.slice(colonIdx + 1);

  switch (field) {
    case 'status':
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
