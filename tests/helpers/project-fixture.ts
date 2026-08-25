import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { checkpointDatabase, closeDatabase, getDatabasePath, openDatabase, openStandaloneDatabase } from '@main/db/connection';
import { SCHEMA_VERSION } from '@main/db/schema';
import { newId } from '@main/utils/id';

export interface TestProject {
  path: string;
  cleanup: () => void;
}

export function createTestProjectFiles(name = 'Test Project'): TestProject {
  const path = mkdtempSync(join(tmpdir(), 'fgtree-test-'));
  writeFileSync(
    join(path, 'project.json'),
    JSON.stringify({
      projectId: newId(),
      name,
      schemaVersion: SCHEMA_VERSION,
      createdAt: '2020-01-01T00:00:00.000Z'
    }),
    'utf-8'
  );
  mkdirSync(join(path, 'media'), { recursive: true });
  mkdirSync(join(path, 'thumbs'), { recursive: true });
  return {
    path,
    cleanup: () => rmSync(path, { recursive: true, force: true })
  };
}

export function createTestProjectDir(name = 'Test Project'): TestProject {
  const project = createTestProjectFiles(name);
  openDatabase(project.path);
  return {
    path: project.path,
    cleanup: () => {
      closeDatabase();
      project.cleanup();
    }
  };
}

/**
 * Snapshot of source project with the same projectId.
 * Does not steal the current open connection — copies sqlite after checkpoint if source is open.
 */
export function createForkedTestProject(sourcePath: string, name = 'Fork'): TestProject {
  const sourceJson = JSON.parse(readFileSync(join(sourcePath, 'project.json'), 'utf-8')) as {
    projectId: string;
    name: string;
    schemaVersion: number;
    createdAt: string;
  };
  const path = mkdtempSync(join(tmpdir(), 'fgtree-fork-'));
  writeFileSync(
    join(path, 'project.json'),
    JSON.stringify(
      {
        projectId: sourceJson.projectId,
        name,
        schemaVersion: sourceJson.schemaVersion ?? SCHEMA_VERSION,
        createdAt: sourceJson.createdAt
      },
      null,
      2
    ),
    'utf-8'
  );
  mkdirSync(join(path, 'media'), { recursive: true });
  mkdirSync(join(path, 'thumbs'), { recursive: true });

  const sourceDb = join(sourcePath, 'family.sqlite');
  const destDb = join(path, 'family.sqlite');
  if (existsSync(sourceDb)) {
    if (getDatabasePath() === sourceDb) {
      checkpointDatabase();
    }
    copyFileSync(sourceDb, destDb);
  } else {
    const db = openStandaloneDatabase(destDb);
    db.close();
  }

  return {
    path,
    cleanup: () => rmSync(path, { recursive: true, force: true })
  };
}

export function createEmptyDir(prefix = 'fgtree-empty-'): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function removeDir(path: string): void {
  rmSync(path, { recursive: true, force: true });
}
