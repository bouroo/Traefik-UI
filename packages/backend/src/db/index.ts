import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from '../config';
import { initDb, assignAdminRoles } from './schema';
import { runMigrations } from './migrations/runner';

let db: Database | undefined;

export function getDb(): Database {
  if (!db) {
    const dbPath = config.db.path;
    if (dbPath !== ':memory:') {
      const dir = dirname(dbPath);
      if (dir) mkdirSync(dir, { recursive: true });
    }
    db = new Database(config.db.path, { create: true });
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');
    initDb(db);
    runMigrations(db);
    assignAdminRoles(db);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = undefined;
  }
}

export function resetDb(): void {
  closeDb();
  getDb(); // Reinitialize fresh
}
