import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestProjectDir } from '../../helpers/project-fixture';
import { isSqliteAvailable } from '../../helpers/sqlite-available';
import { closeProject } from '@main/services/project';
import { createPerson, getPersonDetail, searchPeople, updatePerson } from '@main/services/people';

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

describe.skipIf(!isSqliteAvailable())('people service', () => {
  afterEach(() => {
    closeProject();
  });

  it('saves burial place and coordinates for a deceased person', async () => {
    const project = createTestProjectDir();
    try {
      const person = await createPerson({ firstName: 'Ivan', lastName: 'Ivanov', isLiving: false });
      const updated = await updatePerson({
        id: person.id,
        isLiving: false,
        burial: {
          placeName: 'Новодевичье кладбище',
          latitude: 55.7245,
          longitude: 37.5544
        }
      });

      expect(updated.burialEvent?.placeName).toBe('Новодевичье кладбище');
      expect(updated.burialEvent?.latitude).toBeCloseTo(55.7245);
      expect(updated.burialEvent?.longitude).toBeCloseTo(37.5544);
      expect(updated.events.some((e) => e.type === 'burial')).toBe(false);
    } finally {
      project.cleanup();
    }
  });

  it('removes burial when the person is marked living', async () => {
    const project = createTestProjectDir();
    try {
      const person = await createPerson({
        firstName: 'Maria',
        lastName: 'Ivanova',
        isLiving: false,
        burial: { placeName: 'Ваганьково', latitude: 55.768, longitude: 37.548 }
      });
      expect(person.burialEvent).toBeTruthy();

      await updatePerson({ id: person.id, isLiving: true, death: null, burial: null });
      const detail = await getPersonDetail(person.id);
      expect(detail?.isLiving).toBe(true);
      expect(detail?.burialEvent).toBeNull();
    } finally {
      project.cleanup();
    }
  });

  it('stores and searches English name fields', async () => {
    const project = createTestProjectDir();
    try {
      const person = await createPerson({
        firstName: 'Иван',
        lastName: 'Иванов',
        firstNameEn: 'Ivan',
        lastNameEn: 'Ivanov',
        middleNameEn: 'Petrovich'
      });
      expect(person.firstNameEn).toBe('Ivan');
      expect(person.lastNameEn).toBe('Ivanov');
      expect(person.middleNameEn).toBe('Petrovich');

      const updated = await updatePerson({
        id: person.id,
        maidenNameEn: 'Sidorova'
      });
      expect(updated.maidenNameEn).toBe('Sidorova');
      expect(updated.firstNameEn).toBe('Ivan');

      const found = await searchPeople('ivanov');
      expect(found.some((p) => p.id === person.id)).toBe(true);
    } finally {
      project.cleanup();
    }
  });
});
