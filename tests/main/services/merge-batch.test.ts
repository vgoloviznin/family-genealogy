import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyFileSync, createWriteStream, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ZipArchive } from 'archiver';
import { extractZip } from '@main/utils/safe-extract-zip';
import { createEmptyDir, createForkedTestProject, createTestProjectDir, createTestProjectFiles, removeDir } from '../../helpers/project-fixture';
import { isSqliteAvailable } from '../../helpers/sqlite-available';
import { closeDatabase, getDatabasePath, getSqlite, openDatabase, openStandaloneDatabase } from '@main/db/connection';
import { closeProject, openProjectAtPath } from '@main/services/project';
import { createPerson, listPeople, updatePerson } from '@main/services/people';
import { packProjectArchive } from '@main/services/pack';
import { applyBatchSync, previewBatchSync, sortArchivePaths } from '@main/services/merge-batch';
import { newId } from '@main/utils/id';

vi.mock('@main/services/settings', () => ({
  getDeviceMeta: () => ({ deviceId: 'batch-sync-device', label: 'tester' }),
  getSettings: () => ({
    deviceId: 'batch-sync-device',
    editorLabel: 'Batch Tester',
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

function withForkDb(forkPath: string, fn: (db: ReturnType<typeof openStandaloneDatabase>) => void): void {
  const db = openStandaloneDatabase(join(forkPath, 'family.sqlite'));
  try {
    fn(db);
  } finally {
    db.close();
  }
}

async function setArchiveExportedAt(archivePath: string, exportedAt: string): Promise<void> {
  const unpackDir = mkdtempSync(join(tmpdir(), 'fgtree-rewrite-'));
  const outDir = mkdtempSync(join(tmpdir(), 'fgtree-out-'));
  const outPath = join(outDir, 'archive.fgtree');
  try {
    await extractZip(archivePath, { dir: unpackDir });
    const manifestPath = join(unpackDir, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>;
    manifest.exportedAt = exportedAt;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(outPath);
      const archive = new ZipArchive({ zlib: { level: 6 } });
      output.on('close', () => resolve());
      archive.on('error', reject);
      archive.pipe(output);
      archive.file(join(unpackDir, 'manifest.json'), { name: 'manifest.json' });
      archive.file(join(unpackDir, 'project.json'), { name: 'project.json' });
      archive.file(join(unpackDir, 'family.sqlite'), { name: 'family.sqlite' });
      if (existsSync(join(unpackDir, 'media'))) {
        archive.directory(join(unpackDir, 'media'), 'media');
      }
      if (existsSync(join(unpackDir, 'thumbs'))) {
        archive.directory(join(unpackDir, 'thumbs'), 'thumbs');
      }
      void archive.finalize();
    });
    copyFileSync(outPath, archivePath);
  } finally {
    removeDir(unpackDir);
    rmSync(outPath, { force: true });
    removeDir(outDir);
  }
}

describe.skipIf(!isSqliteAvailable())('merge-batch', () => {
  afterEach(() => {
    closeProject();
  });

  it('applies two archives with different people', async () => {
    const local = createTestProjectDir('Batch Local');
    const archiveDir = createEmptyDir('fgtree-batch-two-');
    const archive1 = join(archiveDir, 'a1.fgtree');
    const archive2 = join(archiveDir, 'a2.fgtree');

    try {
      const fork1 = createForkedTestProject(local.path, 'Remote X');
      const fork2 = createForkedTestProject(local.path, 'Remote Y');
      try {
        const idX = newId();
        const idY = newId();
        const ts = '2024-06-01T00:00:00.000Z';
        withForkDb(fork1.path, (db) => {
          db.prepare(
            `INSERT INTO people (id, first_name, last_name, sex, is_living, created_at, updated_at)
             VALUES (?, 'Person', 'X', 'unknown', 1, ?, ?)`
          ).run(idX, ts, ts);
        });
        withForkDb(fork2.path, (db) => {
          db.prepare(
            `INSERT INTO people (id, first_name, last_name, sex, is_living, created_at, updated_at)
             VALUES (?, 'Person', 'Y', 'unknown', 1, ?, ?)`
          ).run(idY, ts, ts);
        });

        await packProjectArchive(fork1.path, archive1, 'export');
        await packProjectArchive(fork2.path, archive2, 'export');
        await setArchiveExportedAt(archive1, '2024-01-01T00:00:00.000Z');
        await setArchiveExportedAt(archive2, '2024-02-01T00:00:00.000Z');

        openProjectAtPath(local.path);
        const preview = await previewBatchSync([archive2, archive1]);
        expect(preview.archivePaths).toEqual([archive1, archive2]);
        expect(preview.allConflicts).toHaveLength(0);
        expect(getDatabasePath()).toBe(join(local.path, 'family.sqlite'));

        const applied = await applyBatchSync(preview.archivePaths, []);
        expect(applied.archives).toHaveLength(2);
        expect(applied.backupPath).toBeTruthy();

        const people = await listPeople();
        expect(people.some((p) => p.firstName === 'Person' && p.lastName === 'X')).toBe(true);
        expect(people.some((p) => p.firstName === 'Person' && p.lastName === 'Y')).toBe(true);
      } finally {
        fork1.cleanup();
        fork2.cleanup();
      }
    } finally {
      closeProject();
      local.cleanup();
      removeDir(archiveDir);
    }
  });

  it('dedupes the same person conflict across archives (last wins)', async () => {
    const local = createTestProjectDir('Batch Conflict');
    const archiveDir = createEmptyDir('fgtree-batch-conflict-');
    const archive1 = join(archiveDir, 'c1.fgtree');
    const archive2 = join(archiveDir, 'c2.fgtree');

    try {
      const person = await createPerson({ firstName: 'Ann', lastName: 'Smith' });
      await updatePerson({ id: person.id, notes: 'local-notes' });
      const ts = '2024-06-01T00:00:00.000Z';
      getSqlite().prepare('UPDATE people SET updated_at = ? WHERE id = ?').run(ts, person.id);

      const fork1 = createForkedTestProject(local.path, 'C1');
      const fork2 = createForkedTestProject(local.path, 'C2');
      try {
        withForkDb(fork1.path, (db) => {
          db.prepare('UPDATE people SET notes = ?, updated_at = ? WHERE id = ?').run('remote-one', ts, person.id);
        });
        withForkDb(fork2.path, (db) => {
          db.prepare('UPDATE people SET notes = ?, updated_at = ? WHERE id = ?').run('remote-two', ts, person.id);
        });

        await packProjectArchive(fork1.path, archive1, 'export');
        await packProjectArchive(fork2.path, archive2, 'export');
        await setArchiveExportedAt(archive1, '2024-01-01T00:00:00.000Z');
        await setArchiveExportedAt(archive2, '2024-02-01T00:00:00.000Z');

        openProjectAtPath(local.path);
        const preview = await previewBatchSync([archive1, archive2]);
        expect(preview.allConflicts).toHaveLength(1);
        expect(preview.unresolvedConflicts).toBe(1);
        expect(preview.allConflicts[0].id).toBe(person.id);
        expect(preview.allConflicts[0].remote.notes).toBe('remote-two');
        expect(preview.previewNote).toMatch(/из архива/);

        const applied = await applyBatchSync(preview.archivePaths, [{ table: 'people', id: person.id, choice: 'local' }]);
        expect(applied.conflictsResolved).toBeGreaterThanOrEqual(1);

        const people = await listPeople();
        const row = people.find((p) => p.id === person.id);
        expect(row?.notes).toBe('local-notes');
      } finally {
        fork1.cleanup();
        fork2.cleanup();
      }
    } finally {
      closeProject();
      local.cleanup();
      removeDir(archiveDir);
    }
  });

  it('rejects wrong projectId before mutating local', async () => {
    const local = createTestProjectDir('Batch Keep');
    const archiveDir = createEmptyDir('fgtree-batch-wrong-');
    const archivePath = join(archiveDir, 'other.fgtree');

    try {
      await createPerson({ firstName: 'Only', lastName: 'Local' });
      const beforeIds = (await listPeople()).map((p) => p.id).sort();

      const otherFiles = createTestProjectFiles('Other Project');
      openDatabase(otherFiles.path);
      closeDatabase();
      await packProjectArchive(otherFiles.path, archivePath, 'export');

      openProjectAtPath(local.path);
      await expect(previewBatchSync([archivePath])).rejects.toThrow('Это архив другого проекта');

      const afterPreview = await listPeople();
      expect(afterPreview.map((p) => p.id).sort()).toEqual(beforeIds);

      await expect(applyBatchSync([archivePath], [])).rejects.toThrow('Это архив другого проекта');
      const afterApply = await listPeople();
      expect(afterApply.map((p) => p.id).sort()).toEqual(beforeIds);
      expect(afterApply.some((p) => p.firstName === 'Only' && p.lastName === 'Local')).toBe(true);

      otherFiles.cleanup();
    } finally {
      closeProject();
      local.cleanup();
      removeDir(archiveDir);
    }
  });

  it('sorts archives by exportedAt ascending', async () => {
    const local = createTestProjectDir('Batch Sort');
    const archiveDir = createEmptyDir('fgtree-batch-sort-');
    const early = join(archiveDir, 'early.fgtree');
    const late = join(archiveDir, 'late.fgtree');

    try {
      closeDatabase();
      await packProjectArchive(local.path, early, 'export');
      await packProjectArchive(local.path, late, 'export');
      await setArchiveExportedAt(late, '2025-01-01T00:00:00.000Z');
      await setArchiveExportedAt(early, '2023-01-01T00:00:00.000Z');

      openProjectAtPath(local.path);
      const sorted = await sortArchivePaths([late, early]);
      expect(sorted).toEqual([early, late]);

      const preview = await previewBatchSync([late, early]);
      expect(preview.archivePaths).toEqual([early, late]);
    } finally {
      closeProject();
      local.cleanup();
      removeDir(archiveDir);
    }
  });

  it('previewBatchSync does not mutate the open local project', async () => {
    const local = createTestProjectDir('Batch Preview Local');
    const archiveDir = createEmptyDir('fgtree-batch-preview-');
    const archivePath = join(archiveDir, 'only.fgtree');

    try {
      await createPerson({ firstName: 'Before', lastName: 'Preview' });
      const beforeCount = (await listPeople()).length;

      const fork = createForkedTestProject(local.path, 'Batch Remote');
      try {
        const remoteId = newId();
        withForkDb(fork.path, (db) => {
          const ts = '2024-06-01T00:00:00.000Z';
          db.prepare(
            `INSERT INTO people (id, first_name, last_name, sex, is_living, created_at, updated_at)
             VALUES (?, 'After', 'Preview', 'unknown', 1, ?, ?)`
          ).run(remoteId, ts, ts);
        });

        await packProjectArchive(fork.path, archivePath, 'export');
        openProjectAtPath(local.path);

        const preview = await previewBatchSync([archivePath]);
        expect(preview.totalStats?.people?.inserted).toBe(1);
        expect((await listPeople()).length).toBe(beforeCount);
        expect((await listPeople()).some((p) => p.firstName === 'After')).toBe(false);
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
