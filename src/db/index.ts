import { Database } from 'bun:sqlite';
import { config } from '../config';
import { initDb } from './schema';

let db: Database | undefined;

export function getDb(): Database {
  if (!db) {
    db = new Database(config.db.path, { create: true });
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');
    initDb(db);
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
