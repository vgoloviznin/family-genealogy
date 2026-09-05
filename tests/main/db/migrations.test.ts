import { afterEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { runMigrations, getAppliedMigrationVersions } from '@main/db/migrations';
import { SCHEMA_VERSION } from '@main/db/schema';
import { closeProject, openProjectAtPath } from '@main/services/project';
import { createTestProjectDir, createTestProjectFiles } from '../../helpers/project-fixture';
import { isSqliteAvailable } from '../../helpers/sqlite-available';
import { localizedErrorMessage } from '../../helpers/localized-error';
import { newId } from '@main/utils/id';

vi.mock('@main/services/settings', () => ({
  getDeviceMeta: () => ({ deviceId: 'test-device', label: 'tester' }),
  getSettings: () => ({
    deviceId: 'test-device',
    editorLabel: 'tester',
    backupOnQuit: false,
    backupKeepCount: 10,
    recentProjects: [],
    onboardingComplete: true
  }),
  addRecentProject: vi.fn(),
  pruneRecentProjects: vi.fn()
}));

vi.mock('@main/services/undo', () => ({
  clearUndo: vi.fn(),
  recordUndo: vi.fn(),
  withUndoSuppressed: async (fn: () => unknown) => await fn()
}));

describe.skipIf(!isSqliteAvailable())('migrations', () => {
  afterEach(() => {
    closeProject();
  });

  it('applies migrations on fresh database', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fgtree-mig-'));
    const dbPath = join(dir, 'family.sqlite');
    try {
      const sqlite = new Database(dbPath);
      runMigrations(sqlite);
      const versions = getAppliedMigrationVersions(sqlite);
      expect(versions).toEqual([1, 2, 3, 4].filter((v) => v <= SCHEMA_VERSION));
      const people = sqlite.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='people'`).get();
      expect(people).toBeTruthy();
      const cols = sqlite.pragma('table_info(people)') as Array<{ name: string }>;
      expect(cols.map((c) => c.name)).toEqual(expect.arrayContaining(['first_name_en', 'last_name_en', 'middle_name_en', 'maiden_name_en']));
      sqlite.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('applies remaining DDL on a legacy people-only database', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fgtree-legacy-'));
    const dbPath = join(dir, 'family.sqlite');
    try {
      const sqlite = new Database(dbPath);
      sqlite.exec(
        `CREATE TABLE people (id TEXT PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL, sex TEXT NOT NULL DEFAULT 'unknown', is_living INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`
      );
      runMigrations(sqlite);
      expect(getAppliedMigrationVersions(sqlite)).toEqual([1, 2, 3, 4].filter((v) => v <= SCHEMA_VERSION));
      const cols = sqlite.pragma('table_info(events)') as Array<{ name: string }>;
      expect(cols.some((c) => c.name === 'latitude')).toBe(true);
      const peopleCols = sqlite.pragma('table_info(people)') as Array<{ name: string }>;
      expect(peopleCols.some((c) => c.name === 'first_name_en')).toBe(true);
      sqlite.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects database with newer migration version', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fgtree-newmig-'));
    const dbPath = join(dir, 'family.sqlite');
    try {
      const sqlite = new Database(dbPath);
      runMigrations(sqlite);
      sqlite.prepare(`INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)`).run(SCHEMA_VERSION + 1, new Date().toISOString());
      expect(() => runMigrations(sqlite)).toThrow(localizedErrorMessage('errors.databaseNewerVersion'));
      sqlite.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects project.json with newer schemaVersion', () => {
    const project = createTestProjectFiles('Future');
    try {
      writeFileSync(
        join(project.path, 'project.json'),
        JSON.stringify({
          projectId: newId(),
          name: 'Future',
          schemaVersion: SCHEMA_VERSION + 1,
          createdAt: '2020-01-01T00:00:00.000Z'
        }),
        'utf-8'
      );
      const sqlite = new Database(join(project.path, 'family.sqlite'));
      runMigrations(sqlite);
      sqlite.close();
      expect(() => openProjectAtPath(project.path)).toThrow(localizedErrorMessage('errors.projectNewerVersion'));
    } finally {
      project.cleanup();
    }
  });

  it('rejects open when family.sqlite is missing', () => {
    const project = createTestProjectFiles('NoDb');
    try {
      expect(existsSync(join(project.path, 'family.sqlite'))).toBe(false);
      expect(() => openProjectAtPath(project.path)).toThrow(localizedErrorMessage('errors.databaseMissing'));
    } finally {
      project.cleanup();
    }
  });

  it('stamps older project.json after successful migrate', () => {
    const project = createTestProjectDir('OldSchema');
    try {
      const projectId = newId();
      writeFileSync(
        join(project.path, 'project.json'),
        JSON.stringify({
          projectId,
          name: 'OldSchema',
          schemaVersion: 1,
          createdAt: '2020-01-01T00:00:00.000Z'
        }),
        'utf-8'
      );
      closeProject();
      const meta = openProjectAtPath(project.path);
      expect(meta.schemaVersion).toBe(SCHEMA_VERSION);
      const json = JSON.parse(readFileSync(join(project.path, 'project.json'), 'utf-8'));
      expect(json.schemaVersion).toBe(SCHEMA_VERSION);
    } finally {
      project.cleanup();
    }
  });
});
