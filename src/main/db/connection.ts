import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { join } from 'path';
import * as schema from './schema';

export type AppDatabase = BetterSQLite3Database<typeof schema>;

let db: AppDatabase | null = null;
let sqlite: Database.Database | null = null;
let dbPath: string | null = null;

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
    throw new Error('Database not open');
  }
  return db;
}

export function getDatabasePath(): string | null {
  return dbPath;
}

export function getSqlite(): Database.Database {
  if (!sqlite) {
    throw new Error('Database not open');
  }
  return sqlite;
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

function runMigrations(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      middle_name TEXT,
      maiden_name TEXT,
      sex TEXT NOT NULL DEFAULT 'unknown',
      is_living INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      primary_photo_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      created_by_device_id TEXT,
      updated_by_device_id TEXT,
      updated_by_label TEXT
    );

    CREATE TABLE IF NOT EXISTS families (
      id TEXT PRIMARY KEY,
      union_type TEXT NOT NULL DEFAULT 'marriage',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      created_by_device_id TEXT,
      updated_by_device_id TEXT,
      updated_by_label TEXT
    );

    CREATE TABLE IF NOT EXISTS family_partners (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL,
      person_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS family_children (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL,
      person_id TEXT NOT NULL,
      pedigree TEXT NOT NULL DEFAULT 'birth',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS places (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      custom_label TEXT,
      person_id TEXT,
      family_id TEXT,
      place_id TEXT,
      description TEXT,
      latitude REAL,
      longitude REAL,
      date_year INTEGER,
      date_month INTEGER,
      date_day INTEGER,
      date_hour INTEGER,
      date_minute INTEGER,
      date_precision TEXT NOT NULL DEFAULT 'unknown',
      date_original_text TEXT,
      date_sort_key INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      created_by_device_id TEXT,
      updated_by_device_id TEXT,
      updated_by_label TEXT
    );

    CREATE TABLE IF NOT EXISTS associations (
      id TEXT PRIMARY KEY,
      from_person_id TEXT NOT NULL,
      to_person_id TEXT NOT NULL,
      role TEXT NOT NULL,
      custom_role TEXT,
      event_id TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      created_by_device_id TEXT,
      updated_by_device_id TEXT,
      updated_by_label TEXT
    );

    CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      relative_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      caption TEXT,
      description TEXT,
      taken_at TEXT,
      thumb_relative_path TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      created_by_device_id TEXT,
      updated_by_device_id TEXT,
      updated_by_label TEXT
    );

    CREATE TABLE IF NOT EXISTS media_links (
      id TEXT PRIMARY KEY,
      media_id TEXT NOT NULL,
      person_id TEXT,
      event_id TEXT,
      created_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'other',
      author TEXT,
      details TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      created_by_device_id TEXT,
      updated_by_device_id TEXT,
      updated_by_label TEXT
    );

    CREATE TABLE IF NOT EXISTS citations (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      person_id TEXT,
      event_id TEXT,
      page TEXT,
      excerpt TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      created_by_device_id TEXT,
      updated_by_device_id TEXT,
      updated_by_label TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_people_names ON people(last_name, first_name);
    CREATE INDEX IF NOT EXISTS idx_events_person ON events(person_id);
    CREATE INDEX IF NOT EXISTS idx_events_family ON events(family_id);
    CREATE INDEX IF NOT EXISTS idx_places_norm ON places(normalized_name);
    CREATE INDEX IF NOT EXISTS idx_media_links_person ON media_links(person_id);
    CREATE INDEX IF NOT EXISTS idx_media_links_event ON media_links(event_id);
    CREATE INDEX IF NOT EXISTS idx_citations_person ON citations(person_id);
    CREATE INDEX IF NOT EXISTS idx_citations_source ON citations(source_id);
  `);

  ensureColumn(sqlite, 'events', 'latitude', 'REAL');
  ensureColumn(sqlite, 'events', 'longitude', 'REAL');
}

function ensureColumn(sqlite: Database.Database, table: string, column: string, ddl: string): void {
  const info = sqlite.pragma(`table_info(${table})`) as Array<{ name: string }>;
  if (!info.some((col) => col.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
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
