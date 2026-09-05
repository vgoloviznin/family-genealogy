import { afterEach, describe, expect, it, vi } from 'vitest';
import { join } from 'path';
import { createEmptyDir, createForkedTestProject, createTestProjectDir, removeDir } from '../../helpers/project-fixture';
import { isSqliteAvailable } from '../../helpers/sqlite-available';
import { closeProject, openProjectAtPath } from '@main/services/project';
import { createPerson, listPeople, updatePerson } from '@main/services/people';
import { addChildToPerson, addPartner, getFamiliesForPerson } from '@main/services/family';
import { packProjectArchive, unpackProjectArchive, previewSyncFromArchivePath, applySyncFromArchivePath } from '@main/services/pack';
import { canUndo, clearUndo } from '@main/services/undo';

vi.mock('@main/services/settings', () => ({
  getDeviceMeta: () => ({ deviceId: 'smoke-device', label: 'Smoke' }),
  getSettings: () => ({
    deviceId: 'smoke-device',
    editorLabel: 'Smoke',
    backupOnQuit: false,
    backupKeepCount: 10,
    recentProjects: [],
    onboardingComplete: true,
    backupFolder: undefined
  }),
  addRecentProject: vi.fn(),
  pruneRecentProjects: vi.fn()
}));

describe.skipIf(!isSqliteAvailable())('smoke flow: person → family → export → import → sync', () => {
  afterEach(() => {
    clearUndo();
    closeProject();
  });

  it('round-trips core genealogy workflow', async () => {
    const local = createTestProjectDir('Smoke Local');
    const archiveDir = createEmptyDir('fgtree-smoke-archive-');
    const archivePath = join(archiveDir, 'export.fgtree');
    const importDir = createEmptyDir('fgtree-smoke-import-');

    try {
      const person = await createPerson({ firstName: 'Alex', lastName: 'Root' });
      await addPartner(person.id, { firstName: 'Sam', lastName: 'Partner' });
      const families = await getFamiliesForPerson(person.id);
      const child = await addChildToPerson(person.id, { firstName: 'Kid', lastName: 'Root' }, 'birth', families[0]!.id);
      expect(child.firstName).toBe('Kid');

      await packProjectArchive(local.path, archivePath, 'export');

      closeProject();
      const imported = await unpackProjectArchive(archivePath, importDir);
      expect(imported.projectId).toBeTruthy();

      openProjectAtPath(importDir);
      const people = await listPeople();
      expect(people.some((p) => p.firstName === 'Alex')).toBe(true);
      expect(people.some((p) => p.firstName === 'Kid')).toBe(true);

      const fork = createForkedTestProject(importDir, 'Smoke Fork');
      try {
        openProjectAtPath(fork.path);
        const remotePeople = await listPeople();
        const alex = remotePeople.find((p) => p.firstName === 'Alex');
        expect(alex).toBeTruthy();
        await updatePerson({ id: alex!.id, firstName: 'Alexandra' });

        const syncArchive = join(archiveDir, 'sync.fgtree');
        await packProjectArchive(fork.path, syncArchive, 'export');

        openProjectAtPath(importDir);
        const preview = await previewSyncFromArchivePath(syncArchive);
        expect(preview.projectId).toBe(imported.projectId);

        clearUndo();
        await applySyncFromArchivePath(syncArchive, []);
        expect(canUndo()).toBe(false);

        const after = await listPeople();
        expect(after.some((p) => p.firstName === 'Alexandra')).toBe(true);
      } finally {
        fork.cleanup();
      }
    } finally {
      closeProject();
      local.cleanup();
      removeDir(archiveDir);
      removeDir(importDir);
    }
  });
});
