import { afterEach, describe, expect, it, vi } from 'vitest';
import { join } from 'path';
import { readFileSync } from 'fs';
import { extractZip } from '@main/utils/safe-extract-zip';
import { createEmptyDir, createForkedTestProject, createTestProjectDir, createTestProjectFiles, removeDir } from '../../helpers/project-fixture';
import { isSqliteAvailable } from '../../helpers/sqlite-available';
import { closeDatabase, getSqlite, openDatabase } from '@main/db/connection';
import { closeProject, openProjectAtPath } from '@main/services/project';
import { createPerson, listPeople, updatePerson } from '@main/services/people';
import { packProjectArchive, previewSyncFromArchivePath, applySyncFromArchivePath } from '@main/services/pack';
import { newId } from '@main/utils/id';
import { openStandaloneDatabase } from '@main/db/connection';
import { clearUndo } from '@main/services/undo';
import { localizedErrorMessage } from '../../helpers/localized-error';

vi.mock('@main/services/settings', () => ({
  getDeviceMeta: () => ({ deviceId: 'pack-sync-device', label: 'tester' }),
  getSettings: () => ({
    deviceId: 'pack-sync-device',
    editorLabel: 'Sync Tester',
    backupOnQuit: false,
    backupKeepCount: 10,
    recentProjects: []
  }),
  addRecentProject: vi.fn(),
  pruneRecentProjects: vi.fn()
}));

vi.mock('@main/services/undo', () => ({
  clearUndo: vi.fn(),
  pushUndo: vi.fn(),
  performUndo: vi.fn(),
  canUndo: vi.fn(() => false)
}));

describe.skipIf(!isSqliteAvailable())('pack sync path API', () => {
  afterEach(() => {
    closeProject();
    vi.mocked(clearUndo).mockClear();
  });

  it('previews and applies sync from a forked archive', async () => {
    const local = createTestProjectDir('Local Sync');
    const archiveDir = createEmptyDir('fgtree-sync-archive-');
    const archivePath = join(archiveDir, 'remote.fgtree');
    const projectId = JSON.parse(readFileSync(join(local.path, 'project.json'), 'utf-8')).projectId as string;

    try {
      await createPerson({ firstName: 'Local', lastName: 'One' });
      const fork = createForkedTestProject(local.path, 'Remote Sync');
      try {
        const remoteId = newId();
        const db = openStandaloneDatabase(join(fork.path, 'family.sqlite'));
        try {
          const ts = '2024-06-01T00:00:00.000Z';
          db.prepare(
            `INSERT INTO people (id, first_name, last_name, sex, is_living, created_at, updated_at)
             VALUES (?, 'Remote', 'Two', 'unknown', 1, ?, ?)`
          ).run(remoteId, ts, ts);
        } finally {
          db.close();
        }

        await packProjectArchive(fork.path, archivePath, 'export');

        openProjectAtPath(local.path);

        const preview = await previewSyncFromArchivePath(archivePath);
        expect(preview.projectId).toBe(projectId);
        expect(preview.archivePath).toBe(archivePath);
        expect(preview.stats.people?.inserted).toBe(1);
        expect(preview.backupPath ?? null).toBeNull();

        const afterPreview = await listPeople();
        expect(afterPreview.some((p) => p.firstName === 'Remote' && p.lastName === 'Two')).toBe(false);

        vi.mocked(clearUndo).mockClear();
        const applied = await applySyncFromArchivePath(archivePath, []);
        expect(applied.applied).toBe(true);
        expect(applied.backupPath).toBeTruthy();
        expect(applied.stats.people?.inserted).toBe(1);
        expect(clearUndo).toHaveBeenCalledTimes(1);

        const people = await listPeople();
        expect(people.some((p) => p.firstName === 'Remote' && p.lastName === 'Two')).toBe(true);
        expect(people.some((p) => p.firstName === 'Local' && p.lastName === 'One')).toBe(true);
      } finally {
        fork.cleanup();
      }
    } finally {
      closeProject();
      local.cleanup();
      removeDir(archiveDir);
    }
  });

  it('rejects archive with a different projectId and leaves people unchanged', async () => {
    const local = createTestProjectDir('Local Keep');
    const archiveDir = createEmptyDir('fgtree-sync-wrong-');
    const archivePath = join(archiveDir, 'other.fgtree');

    try {
      await createPerson({ firstName: 'Only', lastName: 'Local' });
      const beforeIds = (await listPeople()).map((p) => p.id).sort();

      const otherFiles = createTestProjectFiles('Other Project');
      openDatabase(otherFiles.path);
      closeDatabase();
      await packProjectArchive(otherFiles.path, archivePath, 'export');

      openProjectAtPath(local.path);
      await expect(applySyncFromArchivePath(archivePath, [])).rejects.toThrow(localizedErrorMessage('errors.wrongProjectArchive'));

      const after = await listPeople();
      expect(after.map((p) => p.id).sort()).toEqual(beforeIds);
      expect(after.some((p) => p.firstName === 'Only' && p.lastName === 'Local')).toBe(true);

      otherFiles.cleanup();
    } finally {
      closeProject();
      local.cleanup();
      removeDir(archiveDir);
    }
  });

  it('writes merge metadata into pack manifest', async () => {
    const project = createTestProjectDir('Meta Pack');
    const archiveDir = createEmptyDir('fgtree-meta-');
    const archivePath = join(archiveDir, 'meta.fgtree');
    const unpackDir = createEmptyDir('fgtree-meta-out-');

    try {
      closeDatabase();
      await packProjectArchive(project.path, archivePath, 'export');

      await extractZip(archivePath, { dir: unpackDir });
      const manifest = JSON.parse(readFileSync(join(unpackDir, 'manifest.json'), 'utf-8')) as {
        exportedAt?: string;
        sourceDeviceId?: string;
        editorLabel?: string;
      };
      expect(manifest.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(manifest.sourceDeviceId).toBe('pack-sync-device');
      expect(manifest.editorLabel).toBe('Sync Tester');
    } finally {
      closeProject();
      project.cleanup();
      removeDir(archiveDir);
      removeDir(unpackDir);
    }
  });

  it('preview reports tie conflicts without applying changes', async () => {
    const local = createTestProjectDir('Preview Conflict');
    const archiveDir = createEmptyDir('fgtree-sync-conflict-');
    const archivePath = join(archiveDir, 'conflict.fgtree');

    try {
      const person = await createPerson({ firstName: 'Ann', lastName: 'Smith' });
      await updatePerson({ id: person.id, notes: 'local-notes' });
      const ts = '2024-06-01T00:00:00.000Z';
      getSqlite().prepare('UPDATE people SET updated_at = ? WHERE id = ?').run(ts, person.id);

      const fork = createForkedTestProject(local.path, 'Conflict Remote');
      try {
        const db = openStandaloneDatabase(join(fork.path, 'family.sqlite'));
        try {
          db.prepare('UPDATE people SET notes = ?, updated_at = ? WHERE id = ?').run('remote-notes', ts, person.id);
        } finally {
          db.close();
        }

        await packProjectArchive(fork.path, archivePath, 'export');
        openProjectAtPath(local.path);

        vi.mocked(clearUndo).mockClear();
        const preview = await previewSyncFromArchivePath(archivePath);
        expect(preview.conflicts).toHaveLength(1);
        expect(preview.conflicts[0].detail?.fields).toEqual(
          expect.arrayContaining([{ column: 'notes', local: 'local-notes', remote: 'remote-notes' }])
        );

        const row = await listPeople();
        expect(row.find((p) => p.id === person.id)?.notes).toBe('local-notes');
        expect(clearUndo).not.toHaveBeenCalled();
      } finally {
        fork.cleanup();
      }
    } finally {
      closeProject();
      local.cleanup();
      removeDir(archiveDir);
    }
  });

  it('apply with resolutions clears undo and updates notes', async () => {
    const local = createTestProjectDir('Apply Resolution');
    const archiveDir = createEmptyDir('fgtree-sync-resolve-');
    const archivePath = join(archiveDir, 'resolve.fgtree');

    try {
      const person = await createPerson({ firstName: 'Ann', lastName: 'Smith' });
      await updatePerson({ id: person.id, notes: 'local-notes' });
      const ts = '2024-06-01T00:00:00.000Z';
      getSqlite().prepare('UPDATE people SET updated_at = ? WHERE id = ?').run(ts, person.id);

      const fork = createForkedTestProject(local.path, 'Resolve Remote');
      try {
        const db = openStandaloneDatabase(join(fork.path, 'family.sqlite'));
        try {
          db.prepare('UPDATE people SET notes = ?, updated_at = ? WHERE id = ?').run('remote-notes', ts, person.id);
        } finally {
          db.close();
        }

        await packProjectArchive(fork.path, archivePath, 'export');
        openProjectAtPath(local.path);

        vi.mocked(clearUndo).mockClear();
        const applied = await applySyncFromArchivePath(archivePath, [{ table: 'people', id: person.id, choice: 'remote' }]);
        expect(applied.conflictsResolved).toBe(1);
        expect(clearUndo).toHaveBeenCalledTimes(1);

        const row = (await listPeople()).find((p) => p.id === person.id);
        expect(row?.notes).toBe('remote-notes');
      } finally {
        fork.cleanup();
      }
    } finally {
      closeProject();
      local.cleanup();
      removeDir(archiveDir);
    }
  });
});
