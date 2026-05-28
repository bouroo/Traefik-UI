import type { Context } from 'hono';
import { getDb } from '../db';

export function logAudit(c: Context, action: string, resource: string, resourceId?: string, details?: string): void {
  const db = getDb();
  const userId = c.get('userId') ?? null;
  const ip = c.req.header('x-forwarded-for') || 'unknown';
  db.run(
    'INSERT INTO audit_logs (user_id, action, resource, resource_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, action, resource, resourceId ?? null, details ?? null, ip]
  );
}
