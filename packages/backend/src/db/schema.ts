import { Database } from 'bun:sqlite';
import { config } from '../config';
import { logInfo } from '../lib/logger';

export function generateRandomPassword(length: number = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const maxReject = 256 - (256 % chars.length); // 236; values >= this are discarded
  // Rejection region is 20/256 ≈ 7.8% per byte. Exhausting 32 attempts per
  // character has probability < 10^-35, so the biased fallback is unreachable
  // in practice while still keeping the loop bounded forever.
  const maxAttempts = length * 32;
  let attempts = 0;
  let buffer = new Uint8Array(0);
  let pos = 0;

  function fillBuffer(): void {
    buffer = new Uint8Array(Math.max(length * 2, 64));
    crypto.getRandomValues(buffer);
    pos = 0;
  }

  function nextByte(): number {
    if (pos >= buffer.length) {
      fillBuffer();
    }
    return buffer[pos++];
  }

  let password = '';
  for (let i = 0; i < length; i++) {
    let byte: number;
    if (attempts < maxAttempts) {
      do {
        byte = nextByte();
        attempts++;
      } while (byte >= maxReject && attempts < maxAttempts);
    } else {
      // Exhausted our safety budget; fall back to a single biased byte rather
      // than loop forever. This branch is effectively unreachable in practice.
      byte = nextByte();
    }
    password += chars[byte % chars.length];
  }
  return password;
}

export async function initDb(db: Database): Promise<void> {
  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Create settings table
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // Create api_keys table
  db.run(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      last_used_at TEXT,
      is_active INTEGER DEFAULT 1
    )
  `);

  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash)`);

  // Ensure users table has required columns (for existing DBs upgraded from legacy schema)
  const userColumns = db.query("SELECT name FROM pragma_table_info('users')").all() as {
    name: string;
  }[];
  const userColNames = new Set(userColumns.map((c) => c.name));
  if (!userColNames.has('source')) {
    db.run("ALTER TABLE users ADD COLUMN source TEXT DEFAULT 'local'");
  }
  if (!userColNames.has('subject_id')) {
    db.run('ALTER TABLE users ADD COLUMN subject_id TEXT');
  }
  if (!userColNames.has('email')) {
    db.run('ALTER TABLE users ADD COLUMN email TEXT');
  }
  if (!userColNames.has('is_active')) {
    db.run('ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1');
  }

  // Insert default admin user if users table is empty
  const userCount = db.query(`SELECT COUNT(*) as count FROM users`).get() as { count: number };
  if (userCount.count === 0) {
    const adminUsername = config.bootstrap.adminUsername;
    const envPassword = config.bootstrap.adminPassword;
    const useEnvPassword = envPassword.length > 0;

    const tempPassword = useEnvPassword ? envPassword : generateRandomPassword(12);
    // Hash with argon2id via Bun's built-in password hashing
    const passwordHash = Bun.password.hashSync(tempPassword, {
      algorithm: 'argon2id',
      timeCost: config.auth.argon2.timeCost,
      memoryCost: config.auth.argon2.memoryCost,
    });

    db.run(`INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)`, [
      adminUsername,
      passwordHash,
    ]);

    if (useEnvPassword) {
      logInfo('First run: Default admin user created');
      logInfo('Admin password sourced from ADMIN_PASSWORD env var');
    } else {
      // Print generated password directly to stdout (bypasses structured logger)
      // so it is NOT shipped to log aggregators. This is the one and only place
      // the bootstrap secret is exposed to the operator.
      console.log('');
      console.log('============================================================');
      console.log(' Traefik-UI — first-run admin bootstrap');
      console.log('============================================================');
      console.log(` Username:  ${adminUsername}`);
      console.log(` Password:  ${tempPassword}`);
      console.log('');
      console.log(' Change this password after first login.');
      console.log(' To provision a deterministic admin, set ADMIN_USERNAME and');
      console.log(' ADMIN_PASSWORD environment variables before first start.');
      console.log('============================================================');
      console.log('');
    }
  }
}

/**
 * Assign super_admin role to admin users who have no role assignments.
 * Called after migrations ensure the roles/permissions tables exist.
 */
export function assignAdminRoles(db: Database): void {
  try {
    db.run(`
      INSERT OR IGNORE INTO user_roles (user_id, role_id)
      SELECT u.id, r.id
      FROM users u
      JOIN roles r ON r.name = 'super_admin'
      WHERE u.is_admin = 1
        AND NOT EXISTS (
          SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id
        )
    `);
  } catch {
    // Roles table may not exist yet (pre-migration) — safe to ignore
  }
}
