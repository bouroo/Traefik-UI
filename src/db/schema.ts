import { Database } from 'bun:sqlite';
import * as path from 'node:path';
import { config } from '../config';

function generateRandomPassword(length: number = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars[randomBytes[i] % chars.length];
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

  // Insert default admin user if users table is empty
  const userCount = db.query(`SELECT COUNT(*) as count FROM users`).get() as { count: number };
  if (userCount.count === 0) {
    const tempPassword = generateRandomPassword(12);
    // Hash with argon2id via Bun's built-in password hashing
    const passwordHash = Bun.password.hashSync(tempPassword, {
      algorithm: 'argon2id',
      timeCost: 3,
      memoryCost: 65536,
    });

    db.run(`INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)`, [
      'admin',
      passwordHash,
    ]);

    console.log('\n========================================');
    console.log('  FIRST RUN: Default admin user created');
    console.log('========================================');
    console.log(`  Username: admin`);
    console.log(`  Password: ${tempPassword}`);
    console.log('========================================');
    console.log('  Please change the password after first login!');
    console.log('========================================\n');

    try {
      const rawDir = path.dirname(config.db.path);
      const credsDir = rawDir === '.' ? './data' : rawDir;
      const credsPath = path.join(credsDir, 'admin-credentials.txt');
      await Bun.write(credsPath, `Username: admin\nPassword: ${tempPassword}\n`);
      console.log(`  Credentials saved to: ${credsPath}`);
    } catch (err) {
      console.log(
        `  Warning: Could not save credentials to file: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
