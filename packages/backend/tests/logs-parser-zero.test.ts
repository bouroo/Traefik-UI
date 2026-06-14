import { describe, it, expect } from 'bun:test';
import { parseJSONLine, type AccessLogLine } from '../src/api/logs-parser';

describe('logs-parser — zero/empty value handling (DESIRED behavior)', () => {
  it('sanity: parses standard non-zero JSON line', () => {
    const line =
      '{"time":"2023-10-10T13:55:36Z","method":"GET","path":"/api/test","status":200,"size":1234,"duration":0.05}';
    const result = parseJSONLine(line);
    expect(result).not.toBeNull();
    const parsed = result as AccessLogLine;
    expect(parsed.status).toBe(200);
    expect(parsed.bodyBytesSent).toBe(1234);
    expect(parsed.requestTime).toBe(0.05);
  });

  it('sanity: when only alternative (PascalCase) field is present, uses it', () => {
    const line =
      '{"Timestamp":"2023-10-10T13:55:36Z","RequestMethod":"POST","RequestPath":"/api/x","ResponseStatus":201,"BodyBytesSent":512,"RequestDuration":0.1}';
    const result = parseJSONLine(line);
    expect(result).not.toBeNull();
    const parsed = result as AccessLogLine;
    expect(parsed.status).toBe(201);
    expect(parsed.bodyBytesSent).toBe(512);
    expect(parsed.requestTime).toBe(0.1);
  });

  it('preserves bodyBytesSent === 0 when size is 0 (CURRENTLY FAILS — bug to fix in slice C5)', () => {
    const line = '{"size": 0, "BodyBytesSent": 512}';
    const result = parseJSONLine(line);
    expect(result).not.toBeNull();
    const parsed = result as AccessLogLine;
    expect(parsed.bodyBytesSent).toBe(0);
  });

  it('preserves requestTime === 0 when duration is 0 (CURRENTLY FAILS — bug to fix in slice C5)', () => {
    const line = '{"duration": 0, "RequestDuration": 0.5}';
    const result = parseJSONLine(line);
    expect(result).not.toBeNull();
    const parsed = result as AccessLogLine;
    expect(parsed.requestTime).toBe(0);
  });

  it('preserves status === 0 when status field is 0 (CURRENTLY FAILS — bug to fix in slice C5)', () => {
    const line = '{"status": 0, "ResponseStatus": 200}';
    const result = parseJSONLine(line);
    expect(result).not.toBeNull();
    const parsed = result as AccessLogLine;
    expect(parsed.status).toBe(0);
  });
});
