import { describe, it, expect } from 'bun:test';
import {
  parseCLFLine,
  parseJSONLine,
  isJSONLine,
  applyFilter,
  type AccessLogLine,
  CLF_REGEX,
} from '../src/api/logs-parser';

describe('logs-parser', () => {
  describe('CLF_REGEX', () => {
    it('should match valid CLF format line', () => {
      const line =
        '192.168.1.1 - user [10/Oct/2023:13:55:36 +0000] "GET /api/test HTTP/1.1" 200 1234 "-" "Mozilla/5.0" 0.123';
      expect(CLF_REGEX.test(line)).toBe(true);
    });

    it('should not match invalid line', () => {
      const line = 'not a valid clf line';
      expect(CLF_REGEX.test(line)).toBe(false);
    });
  });

  describe('parseCLFLine', () => {
    it('should parse valid CLF line into AccessLogLine', () => {
      const line =
        '192.168.1.1 - admin [10/Oct/2023:13:55:36 +0000] "POST /api/users HTTP/1.1" 201 5678 "https://example.com" "Chrome/120.0" 0.456';
      const result = parseCLFLine(line);

      expect(result).not.toBeNull();
      const parsed = result as AccessLogLine;
      expect(parsed.remoteAddr).toBe('192.168.1.1');
      expect(parsed.remoteUser).toBe('admin');
      expect(parsed.timestamp).toBe('10/Oct/2023:13:55:36 +0000');
      expect(parsed.method).toBe('POST');
      expect(parsed.path).toBe('/api/users');
      expect(parsed.protocol).toBe('HTTP/1.1');
      expect(parsed.status).toBe(201);
      expect(parsed.bodyBytesSent).toBe(5678);
      expect(parsed.httpReferer).toBe('https://example.com');
      expect(parsed.httpUserAgent).toBe('Chrome/120.0');
      expect(parsed.requestTime).toBe(0.456);
      expect(parsed.raw).toBe(line);
    });

    it('should handle missing optional fields', () => {
      const line = '10.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET / HTTP/1.1" 200 0 "-" "-" 0.001';
      const result = parseCLFLine(line);

      expect(result).not.toBeNull();
      const parsed = result as AccessLogLine;
      expect(parsed.remoteAddr).toBe('10.0.0.1');
      expect(parsed.remoteUser).toBe('-');
      expect(parsed.httpReferer).toBe('-');
      expect(parsed.httpUserAgent).toBe('-');
    });

    it('should return null for invalid line', () => {
      const invalidLines = [
        'not a valid line',
        'missing brackets [',
        '',
        '192.168.1.1 - user request without proper format',
      ];

      for (const line of invalidLines) {
        expect(parseCLFLine(line)).toBeNull();
      }
    });

    it('should return null for JSON-like line', () => {
      const jsonLine = '{"method":"GET","path":"/api"}';
      expect(parseCLFLine(jsonLine)).toBeNull();
    });
  });

  describe('parseJSONLine', () => {
    it('should parse valid JSON line with time field', () => {
      const line =
        '{"time":"2023-10-10T13:55:36Z","method":"GET","path":"/api/test","protocol":"HTTP/1.1","status":200,"size":1234,"duration":0.05,"client_ip":"192.168.1.100","user":"testuser","referer":"https://google.com","ua":"Chrome/120"}';
      const result = parseJSONLine(line);

      expect(result).not.toBeNull();
      const parsed = result as AccessLogLine;
      expect(parsed.timestamp).toBe('2023-10-10T13:55:36Z');
      expect(parsed.method).toBe('GET');
      expect(parsed.path).toBe('/api/test');
      expect(parsed.protocol).toBe('HTTP/1.1');
      expect(parsed.status).toBe(200);
      expect(parsed.bodyBytesSent).toBe(1234);
      expect(parsed.requestTime).toBe(0.05);
      expect(parsed.remoteAddr).toBe('192.168.1.100');
      expect(parsed.remoteUser).toBe('testuser');
      expect(parsed.httpReferer).toBe('https://google.com');
      expect(parsed.httpUserAgent).toBe('Chrome/120');
      expect(parsed.raw).toBe(line);
    });

    it('should parse JSON with alternative field names', () => {
      const line =
        '{"Timestamp":"2023-10-10T13:55:36Z","RequestMethod":"POST","RequestPath":"/api/create","RequestProtocol":"HTTP/2","ResponseStatus":201,"BodyBytesSent":512,"RequestDuration":0.1,"RemoteAddr":"10.0.0.1","remoteUser":"admin","httpReferer":"","user_agent":"Safari"}';
      const result = parseJSONLine(line);

      expect(result).not.toBeNull();
      const parsed = result as AccessLogLine;
      expect(parsed.timestamp).toBe('2023-10-10T13:55:36Z');
      expect(parsed.method).toBe('POST');
      expect(parsed.path).toBe('/api/create');
      expect(parsed.protocol).toBe('HTTP/2');
      expect(parsed.status).toBe(201);
      expect(parsed.bodyBytesSent).toBe(512);
      expect(parsed.requestTime).toBe(0.1);
      expect(parsed.remoteAddr).toBe('10.0.0.1');
      expect(parsed.remoteUser).toBe('admin');
      expect(parsed.httpUserAgent).toBe('Safari');
    });

    it('should handle minimal JSON with url field', () => {
      const line = '{"url":"/minimal","status":404}';
      const result = parseJSONLine(line);

      expect(result).not.toBeNull();
      const parsed = result as AccessLogLine;
      expect(parsed.path).toBe('/minimal');
      expect(parsed.status).toBe(404);
      expect(parsed.method).toBe('UNKNOWN');
    });

    it('should return null for invalid JSON', () => {
      const invalidLines = [
        '{invalid json}',
        'not json at all',
        '',
        '{ "method": "GET", missing closing brace',
      ];

      for (const line of invalidLines) {
        expect(parseJSONLine(line)).toBeNull();
      }
    });

    it('should use defaults for missing optional fields', () => {
      const line = '{"status":500}';
      const result = parseJSONLine(line);

      expect(result).not.toBeNull();
      const parsed = result as AccessLogLine;
      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(parsed.method).toBe('UNKNOWN');
      expect(parsed.path).toBe('/');
      expect(parsed.protocol).toBe('');
      expect(parsed.status).toBe(500);
      expect(parsed.bodyBytesSent).toBe(0);
      expect(parsed.requestTime).toBe(0);
      expect(parsed.remoteAddr).toBe('');
      expect(parsed.remoteUser).toBe('');
      expect(parsed.httpReferer).toBe('');
      expect(parsed.httpUserAgent).toBe('');
    });
  });

  describe('isJSONLine', () => {
    it('should return true for line starting with {', () => {
      expect(isJSONLine('{"method":"GET"}')).toBe(true);
    });

    it('should return false for whitespace-prefixed JSON since caller must pre-trim', () => {
      expect(isJSONLine('  {"method":"GET"}')).toBe(false);
      expect(isJSONLine('\t{"method":"GET"}')).toBe(false);
      expect(isJSONLine('\n{"method":"GET"}')).toBe(false);
    });

    it('should return false for CLF line', () => {
      expect(
        isJSONLine(
          '192.168.1.1 - user [10/Oct/2023:13:55:36 +0000] "GET /api HTTP/1.1" 200 100 "-" "-" 0.1'
        )
      ).toBe(false);
    });

    it('should return false for plain text', () => {
      expect(isJSONLine('plain text log line')).toBe(false);
      expect(isJSONLine('')).toBe(false);
    });

    it('should return false for JSON-like string that does not start with {', () => {
      expect(isJSONLine('log: {"method":"GET"}')).toBe(false);
      expect(isJSONLine('2023-10-10 {"method":"GET"}')).toBe(false);
    });
  });

  describe('applyFilter', () => {
    const sampleLines: AccessLogLine[] = [
      {
        timestamp: '2023-10-10',
        method: 'GET',
        path: '/api/users',
        protocol: 'HTTP/1.1',
        status: 200,
        bodyBytesSent: 100,
        requestTime: 0.05,
        remoteAddr: '192.168.1.1',
        remoteUser: '',
        httpReferer: '',
        httpUserAgent: '',
        raw: '',
      },
      {
        timestamp: '2023-10-10',
        method: 'POST',
        path: '/api/users',
        protocol: 'HTTP/1.1',
        status: 201,
        bodyBytesSent: 50,
        requestTime: 0.1,
        remoteAddr: '192.168.1.2',
        remoteUser: '',
        httpReferer: '',
        httpUserAgent: '',
        raw: '',
      },
      {
        timestamp: '2023-10-10',
        method: 'GET',
        path: '/api/orders',
        protocol: 'HTTP/1.1',
        status: 500,
        bodyBytesSent: 0,
        requestTime: 0.5,
        remoteAddr: '192.168.1.3',
        remoteUser: '',
        httpReferer: '',
        httpUserAgent: '',
        raw: '',
      },
      {
        timestamp: '2023-10-10',
        method: 'DELETE',
        path: '/api/users/1',
        protocol: 'HTTP/1.1',
        status: 404,
        bodyBytesSent: 0,
        requestTime: 0.02,
        remoteAddr: '192.168.1.4',
        remoteUser: '',
        httpReferer: '',
        httpUserAgent: '',
        raw: '',
      },
      {
        timestamp: '2023-10-10',
        method: 'GET',
        path: '/html/page.html',
        protocol: 'HTTP/1.1',
        status: 503,
        bodyBytesSent: 0,
        requestTime: 1.0,
        remoteAddr: '192.168.1.5',
        remoteUser: '',
        httpReferer: '',
        httpUserAgent: '',
        raw: '',
      },
    ];

    it('should filter by status:5xx (5xx range)', () => {
      const result = applyFilter(sampleLines, 'status:5xx');
      expect(result.length).toBe(2);
      expect(result.map((l) => l.status)).toEqual([500, 503]);
    });

    it('should filter by status:404 exact match', () => {
      const result = applyFilter(sampleLines, 'status:404');
      expect(result.length).toBe(1);
      expect(result[0].status).toBe(404);
    });

    it('should filter by method:GET case-insensitively', () => {
      const result = applyFilter(sampleLines, 'method:get');
      expect(result.length).toBe(3);
      expect(result.every((l) => l.method === 'GET')).toBe(true);
    });

    it('should filter by method:POST case-insensitively', () => {
      const result = applyFilter(sampleLines, 'method:POST');
      expect(result.length).toBe(1);
      expect(result[0].method).toBe('POST');
    });

    it('should filter by path substring match', () => {
      const result = applyFilter(sampleLines, 'path:/api');
      expect(result.length).toBe(4);
      expect(result.every((l) => l.path.includes('/api'))).toBe(true);
    });

    it('should filter by path:/users substring', () => {
      const result = applyFilter(sampleLines, 'path:/users');
      expect(result.length).toBe(3);
      expect(result.every((l) => l.path.includes('/users'))).toBe(true);
    });

    it('should return all lines for unknown filter field', () => {
      const result = applyFilter(sampleLines, 'unknown:value');
      expect(result.length).toBe(5);
      expect(result).toEqual(sampleLines);
    });

    it('should return all lines for empty filter', () => {
      const result = applyFilter(sampleLines, '');
      expect(result.length).toBe(5);
      expect(result).toEqual(sampleLines);
    });

    it('should return all lines for filter without colon', () => {
      const result = applyFilter(sampleLines, 'justsomefilter');
      expect(result.length).toBe(5);
    });

    it('should handle filter with multiple colons by using only first colon as delimiter', () => {
      const result = applyFilter(sampleLines, 'status:200:extra');
      expect(result.length).toBe(0);
    });

    it('should filter path containing colons (e.g., URL)', () => {
      const linesWithUrl: AccessLogLine[] = [
        ...sampleLines,
        {
          timestamp: '2023-10-10',
          method: 'GET',
          path: 'http://example.com/api',
          protocol: 'HTTP/1.1',
          status: 200,
          bodyBytesSent: 100,
          requestTime: 0.05,
          remoteAddr: '192.168.1.1',
          remoteUser: '',
          httpReferer: '',
          httpUserAgent: '',
          raw: '',
        },
      ];
      const result = applyFilter(linesWithUrl, 'path:http://example.com');
      expect(result.length).toBe(1);
      expect(result[0].path).toBe('http://example.com/api');
    });
  });
});
