import type Database from 'better-sqlite3';
import { SCHEMA_VERSION } from './schema';
import { localizedError } from '../i18n';

const MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
)`;

const MIGRATION_1_DDL = `
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
`;

type Migration = {
  version: number;
  apply: (sqlite: Database.Database) => void;
};

function ensureColumn(sqlite: Database.Database, table: string, column: string, ddl: string): void {
  const info = sqlite.pragma(`table_info(${table})`) as Array<{ name: string }>;
  if (!info.some((col) => col.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

function tableExists(sqlite: Database.Database, name: string): boolean {
  const row = sqlite.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`).get(name) as
    | { name: string }
    | undefined;
  return Boolean(row);
}

function appliedVersions(sqlite: Database.Database): number[] {
  if (!tableExists(sqlite, 'schema_migrations')) {
    return [];
  }
  const rows = sqlite.prepare(`SELECT version FROM schema_migrations ORDER BY version`).all() as Array<{ version: number }>;
  return rows.map((r) => r.version);
}

function markApplied(sqlite: Database.Database, version: number): void {
  sqlite.prepare(`INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)`).run(version, new Date().toISOString());
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    apply: (sqlite) => {
      sqlite.exec(MIGRATION_1_DDL);
    }
  },
  {
    version: 2,
    apply: (sqlite) => {
      ensureColumn(sqlite, 'events', 'latitude', 'REAL');
      ensureColumn(sqlite, 'events', 'longitude', 'REAL');
    }
  },
  {
    version: 3,
    apply: () => {
      // Historical schema version marker; no DDL.
    }
  }
];

/**
 * Apply pending migrations. Throws if DB was created by a newer app.
 * CREATE IF NOT EXISTS / ensureColumn are idempotent, so legacy DBs still run pending versions.
 */
export function runMigrations(sqlite: Database.Database): void {
  sqlite.exec('BEGIN IMMEDIATE');
  try {
    sqlite.exec(MIGRATIONS_TABLE);

    const applied = appliedVersions(sqlite);
    const maxApplied = applied.length > 0 ? Math.max(...applied) : 0;

    if (maxApplied > SCHEMA_VERSION) {
      throw new Error(localizedError('errors.databaseNewerVersion'));
    }

    const appliedSet = new Set(applied);
    for (const migration of MIGRATIONS) {
      if (migration.version > SCHEMA_VERSION) {
        continue;
      }
      if (appliedSet.has(migration.version)) {
        continue;
      }
      migration.apply(sqlite);
      markApplied(sqlite, migration.version);
    }
    sqlite.exec('COMMIT');
  } catch (err) {
    try {
      sqlite.exec('ROLLBACK');
    } catch {
      // ignore
    }
    throw err;
  }
}

export function getAppliedMigrationVersions(sqlite: Database.Database): number[] {
  return appliedVersions(sqlite);
}
