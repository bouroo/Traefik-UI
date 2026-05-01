import type { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';
import { config } from '../config';

// Extend Hono's ContextVariableMap for type safety
declare module 'hono' {
  interface ContextVariableMap {
    userId: number;
    username: string;
  }
}

interface JwtPayload {
  sub: number;
  username: string;
}

// Authenticate requests via Bearer token in Authorization header.
// Sets ctx.set('userId', payload.sub) and ctx.set('username', payload.username) on success.
// Returns 401 JSON if missing/invalid token.
export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');

  if (!authHeader) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = parts[1];

  try {
    const payload = jwt.verify(token, config.auth.jwtSecret);
    if (typeof payload === 'string') {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const typedPayload = payload as unknown as JwtPayload;
    c.set('userId', typedPayload.sub);
    c.set('username', typedPayload.username);
    return next();
  } catch {
    return c.json({ error: 'Unauthorized' }, 401);
  }
}

// Generate a JWT token for a user
export function generateToken(userId: number, username: string): string {
  return jwt.sign({ sub: userId, username }, config.auth.jwtSecret, {
    expiresIn: config.auth.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

// Optional: refresh token endpoint helper
export async function refreshToken(c: Context): Promise<Response> {
  const userId = c.get('userId');
  const username = c.get('username');

  if (!userId || !username) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = generateToken(userId, username);
  return c.json({ token });
}
