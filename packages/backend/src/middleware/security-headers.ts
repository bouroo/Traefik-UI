import type { MiddlewareHandler } from 'hono';
import { config } from '../config';

export function securityHeaders(): MiddlewareHandler {
  return async (c, next) => {
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('X-XSS-Protection', '0');
    c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    if (config.security.hsts) {
      c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    await next();
  };
}
