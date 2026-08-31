import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestProjectDir } from '../../helpers/project-fixture';
import { isSqliteAvailable } from '../../helpers/sqlite-available';
import { closeProject } from '@main/services/project';
import { createPerson } from '@main/services/people';
import { createAssociation, deleteAssociation, listAssociationsForPerson } from '@main/services/associations';

vi.mock('@main/services/settings', () => ({
  getDeviceMeta: () => ({ deviceId: 'test-device', label: 'tester' }),
  getSettings: () => ({
    deviceId: 'test-device',
    editorLabel: '',
    backupOnQuit: false,
    backupKeepCount: 10,
    recentProjects: []
  }),
  addRecentProject: vi.fn(),
  pruneRecentProjects: vi.fn()
}));

describe.skipIf(!isSqliteAvailable())('associations service', () => {
  afterEach(() => {
    closeProject();
  });

  it('creates and lists associations from both sides', async () => {
    const project = createTestProjectDir();
    try {
      const godparent = await createPerson({ firstName: 'Olga', lastName: 'Smirnova' });
      const child = await createPerson({ firstName: 'Petr', lastName: 'Smirnov' });

      const created = await createAssociation({
        fromPersonId: godparent.id,
        toPersonId: child.id,
        role: 'godparent',
        notes: 'Крестная мама'
      });

      expect(created.role).toBe('godparent');
      expect(created.toPerson.id).toBe(child.id);

      const fromList = await listAssociationsForPerson(godparent.id);
      expect(fromList).toHaveLength(1);
      expect(fromList[0].toPerson.firstName).toBe('Petr');

      const toList = await listAssociationsForPerson(child.id);
      expect(toList).toHaveLength(1);
      expect(toList[0].toPerson.firstName).toBe('Olga');
    } finally {
      project.cleanup();
    }
  });

  it('soft-deletes associations', async () => {
    const project = createTestProjectDir();
    try {
      const witness = await createPerson({ firstName: 'Witness', lastName: 'One' });
      const bride = await createPerson({ firstName: 'Bride', lastName: 'Two' });
      const association = await createAssociation({
        fromPersonId: witness.id,
        toPersonId: bride.id,
        role: 'witness'
      });

      await deleteAssociation(association.id);

      expect(await listAssociationsForPerson(witness.id)).toHaveLength(0);
      expect(await listAssociationsForPerson(bride.id)).toHaveLength(0);
    } finally {
      project.cleanup();
    }
  });
});
