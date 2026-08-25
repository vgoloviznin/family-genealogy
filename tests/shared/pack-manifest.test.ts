import { describe, expect, it, vi } from 'vitest';
import { join } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { validatePackManifest, verifyPackDatabaseHash } from '@shared/pack-manifest';
import { createEmptyDir, createTestProjectDir, removeDir } from '../helpers/project-fixture';
import { isSqliteAvailable } from '../helpers/sqlite-available';
import { closeDatabase } from '@main/db/connection';
import { closeProject } from '@main/services/project';
import { createPerson, listPeople } from '@main/services/people';
import { packProjectArchive, unpackProjectArchive } from '@main/services/pack';

vi.mock('@main/services/settings', () => ({
  getDeviceMeta: () => ({ deviceId: 'pack-test-device', label: 'tester' }),
  getSettings: () => ({
    deviceId: 'pack-test-device',
    editorLabel: '',
    backupOnQuit: false,
    backupKeepCount: 10,
    recentProjects: []
  }),
  addRecentProject: vi.fn(),
  pruneRecentProjects: vi.fn()
}));

vi.mock('@main/services/undo', () => ({
  clearUndo: vi.fn()
}));

function sha256File(path: string): Promise<string> {
  return Promise.resolve(createHash('sha256').update(readFileSync(path)).digest('hex'));
}

describe('pack manifest', () => {
  it('accepts a valid fgtree manifest', () => {
    expect(
      validatePackManifest({
        format: 'fgtree',
        formatVersion: 1,
        kind: 'export',
        schemaVersion: 1,
        projectId: 'p1',
        projectName: 'Demo'
      }).projectName
    ).toBe('Demo');
  });

  it('rejects unknown archive format', () => {
    expect(() => validatePackManifest({ format: 'zip' })).toThrow('Неверный формат архива');
  });

  it('detects sqlite hash mismatch', async () => {
    const dir = createEmptyDir('fgtree-hash-');
    const dbPath = join(dir, 'family.sqlite');
    writeFileSync(dbPath, 'test-db-content');
    try {
      await expect(verifyPackDatabaseHash({ format: 'fgtree', sqliteSha256: 'deadbeef' } as never, dbPath, sha256File)).rejects.toThrow(
        'Кontрольная сумма базы данных не совпадает'
      );
    } finally {
      removeDir(dir);
    }
  });
});

describe.skipIf(!isSqliteAvailable())('packProjectArchive', () => {
  it('round-trips a project through fgtree archive', async () => {
    const source = createTestProjectDir('Archive Me');
    const archivePath = join(createEmptyDir('fgtree-archive-'), 'project.fgtree');
    const destPath = createEmptyDir('fgtree-restore-');

    try {
      await createPerson({ firstName: 'Packed', lastName: 'Person' });
      closeDatabase();

      await packProjectArchive(source.path, archivePath, 'export');
      const restored = await unpackProjectArchive(archivePath, destPath);

      expect(restored.name).toBe('Archive Me');
      expect(restored.path).toBe(destPath);
      const people = await listPeople();
      expect(people.some((p) => p.lastName === 'Person')).toBe(true);
    } finally {
      closeProject();
      source.cleanup();
      removeDir(destPath);
      removeDir(join(archivePath, '..'));
    }
  });
});
