import { Hono } from 'hono';
import { config } from '../config';
import { getDb } from '../db';
import { authMiddleware, generateToken } from './middleware';

const auth = new Hono();

interface LoginBody {
  username: string;
  password: string;
}

interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

interface User {
  id: number;
  username: string;
  password_hash: string;
  is_admin: number;
  created_at: string;
  last_login: string | null;
}

// POST /api/auth/login
// Body: { username: string, password: string }
// Validates credentials against SQLite users table
// Returns { token: string, user: { id, username } } on success
// Returns 401 on invalid credentials
auth.post('/login', async (c) => {
  let body: LoginBody;

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  const { username, password } = body;

  if (!username || !password) {
    return c.json({ error: 'Username and password are required' }, 400);
  }

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
    .query('SELECT id, username, is_admin, created_at FROM users WHERE id = ?')
    .get(userId) as Omit<User, 'password_hash' | 'last_login'> | undefined;

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({ user });
});

// POST /api/auth/change-password
// Protected: requires authMiddleware
// Body: { currentPassword: string, newPassword: string }
// Validates current password, updates to new (argon2id hashed)
auth.post('/change-password', authMiddleware, async (c) => {
  const userId = c.get('userId');
  let body: ChangePasswordBody;

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return c.json({ error: 'Current password and new password are required' }, 400);
  }

  if (newPassword.length < 6) {
    return c.json({ error: 'New password must be at least 6 characters' }, 400);
  }

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
