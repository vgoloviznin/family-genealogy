import { AsyncLocalStorage } from 'async_hooks';
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { join } from 'path';
import { localizedError } from '../i18n';
import * as schema from './schema';
import { runMigrations } from './migrations';

export type AppDatabase = BetterSQLite3Database<typeof schema>;

let db: AppDatabase | null = null;
let sqlite: Database.Database | null = null;
let dbPath: string | null = null;
let txQueue: Promise<void> = Promise.resolve();
const inTransaction = new AsyncLocalStorage<boolean>();

export function openDatabase(projectPath: string): AppDatabase {
  closeDatabase();
  dbPath = join(projectPath, 'family.sqlite');
  sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('foreign_keys = ON');
  db = drizzle(sqlite, { schema });
  runMigrations(sqlite);
  return db;
}

export function getDatabase(): AppDatabase {
  if (!db) {
    throw new Error(localizedError('errors.databaseNotOpen'));
  }
  return db;
}

export function getDatabasePath(): string | null {
  return dbPath;
}

export function getSqlite(): Database.Database {
  if (!sqlite) {
    throw new Error(localizedError('errors.databaseNotOpen'));
  }
  return sqlite;
}

/**
 * Run fn inside a better-sqlite3 transaction.
 * Nested calls reuse the open transaction (no second BEGIN).
 * Concurrent callers are queued so await-ed drizzle work cannot interleave BEGINs.
 */
export async function withSqliteTransaction<T>(fn: () => Promise<T> | T): Promise<T> {
  if (inTransaction.getStore()) {
    return await fn();
  }

  let release!: () => void;
  const previous = txQueue;
  txQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;

  const dbHandle = getSqlite();
  dbHandle.exec('BEGIN IMMEDIATE');
  try {
    const result = await inTransaction.run(true, fn);
    dbHandle.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      dbHandle.exec('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw err;
  } finally {
    release();
  }
}

/** Open a DB file with migrations without touching the current project connection. */
export function openStandaloneDatabase(dbFilePath: string): Database.Database {
  const standalone = new Database(dbFilePath);
  standalone.pragma('journal_mode = WAL');
  standalone.pragma('busy_timeout = 5000');
  standalone.pragma('foreign_keys = ON');
  runMigrations(standalone);
  return standalone;
}

export function closeDatabase(): void {
  if (sqlite) {
    sqlite.close();
    sqlite = null;
  }
  db = null;
  dbPath = null;
}

export function checkpointDatabase(): void {
  if (sqlite) {
    sqlite.pragma('wal_checkpoint(TRUNCATE)');
    return;
  }
  const path = dbPath;
  if (!path) {
    return;
  }
  const temp = new Database(path);
  temp.pragma('wal_checkpoint(TRUNCATE)');
  temp.close();
}
