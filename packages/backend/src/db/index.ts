import { Database } from 'bun:sqlite';
import { config } from '../config';
import { initDb, assignAdminRoles } from './schema';
import { runMigrations } from './migrations/runner';

let db: Database | undefined;

export function getDb(): Database {
  if (!db) {
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
