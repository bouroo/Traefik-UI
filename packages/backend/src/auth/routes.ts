import { Hono } from 'hono';
import { config } from '../config';
import { getDb } from '../db';
import { authMiddleware, generateToken } from './middleware';
import { getUserPermissions } from './rbac';
import { validateBody } from '../middleware/validate';
import type { ValidationSchema } from '../middleware/validate';

const auth = new Hono();

interface LoginBody {
  username: string;
  password: string;
}

interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

const loginSchema: ValidationSchema = {
  username: { type: 'string', required: true, minLength: 1 },
  password: { type: 'string', required: true, minLength: 1 },
};

const changePasswordSchema: ValidationSchema = {
  currentPassword: { type: 'string', required: true },
  newPassword: { type: 'string', required: true, minLength: 6 },
};

interface User {
  id: number;
  username: string;
  password_hash: string;
  is_admin: number;
  created_at: string;
  last_login: string | null;
  source: string;
  email: string | null;
  is_active: number;
}

// POST /api/auth/login
// Body: { username: string, password: string }
// Validates credentials against SQLite users table
// Returns { token: string, user: { id, username } } on success
// Returns 401 on invalid credentials
auth.post('/login', validateBody(loginSchema), async (c) => {
  const body = c.get('parsedBody') as LoginBody;
  const { username, password } = body;

  const db = getDb();
  const user = db.query('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;

  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const isValidPassword = await Bun.password.verify(password, user.password_hash);

  if (!isValidPassword) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  // Update updated_at timestamp
  db.query('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

  const token = generateToken(user.id, user.username);

  return c.json({
    token,
    user: {
      id: user.id,
      username: user.username,
    },
  });
});

// GET /api/auth/me
// Protected: requires authMiddleware
// Returns current user info
auth.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const user = db
    .query(
      'SELECT id, username, is_admin, source, email, is_active, created_at FROM users WHERE id = ?'
    )
    .get(userId) as Omit<User, 'password_hash' | 'last_login'> | undefined;

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const permissions = getUserPermissions(userId);

  return c.json({
    user: {
      id: user.id,
      username: user.username,
      is_admin: user.is_admin,
      source: user.source,
      email: user.email,
      is_active: user.is_active,
      created_at: user.created_at,
    },
    permissions,
  });
});

// POST /api/auth/change-password
// Protected: requires authMiddleware
// Body: { currentPassword: string, newPassword: string }
// Validates current password, updates to new (argon2id hashed)
auth.post('/change-password', authMiddleware, validateBody(changePasswordSchema), async (c) => {
  const userId = c.get('userId');
  const body = c.get('parsedBody') as ChangePasswordBody;
  const { currentPassword, newPassword } = body;

  const db = getDb();
  const user = db.query('SELECT * FROM users WHERE id = ?').get(userId) as User | undefined;

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const isValidPassword = await Bun.password.verify(currentPassword, user.password_hash);

  if (!isValidPassword) {
    return c.json({ error: 'Current password is incorrect' }, 401);
  }

  const newPasswordHash = await Bun.password.hash(newPassword, {
    algorithm: 'argon2id',
    timeCost: config.auth.argon2.timeCost,
    memoryCost: config.auth.argon2.memoryCost,
  });
  db.query('UPDATE users SET password_hash = ? WHERE id = ?').run(newPasswordHash, userId);

  return c.json({ success: true });
});

// POST /api/auth/logout
// Just returns success (stateless JWT — client should discard token)
auth.post('/logout', async (c) => {
  return c.json({ success: true });
});

// POST /api/auth/refresh
// Protected: requires authMiddleware
// Returns a new token for the current user
auth.post('/refresh', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const username = c.get('username');
  const token = generateToken(userId!, username!);
  return c.json({ token });
});

export { auth };
