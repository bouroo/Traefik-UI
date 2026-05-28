import { Database } from 'bun:sqlite';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export function runMigrations(db: Database): void {
  const runnerDir = dirname(fileURLToPath(import.meta.url));
  const migrationsDir = resolve(runnerDir, '..', 'migrations');
  if (!existsSync(migrationsDir)) {
    return;
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `);

  const migrationFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    const alreadyApplied = db
      .query("SELECT 1 FROM migrations WHERE name = ?")
      .get(file);

    if (alreadyApplied) {
      continue;
    }

    const filePath = resolve(migrationsDir, file);
    const sql = readFileSync(filePath, 'utf-8');

    db.transaction(() => {
      db.exec(sql);
      db.run("INSERT INTO migrations (name) VALUES (?)", [file]);
    })();
  }
}
