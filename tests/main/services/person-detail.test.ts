import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestProjectDir } from '../../helpers/project-fixture';
import { isSqliteAvailable } from '../../helpers/sqlite-available';
import { closeProject } from '@main/services/project';
import { createPerson, getPersonDetail, upsertEventRecord } from '@main/services/people';
import { addPartner } from '@main/services/family';

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

describe.skipIf(!isSqliteAvailable())('person-detail service', () => {
  afterEach(() => {
    closeProject();
  });

  it('includes family events for partner families without loading unrelated events', async () => {
    const project = createTestProjectDir();
    try {
      const bride = await createPerson({ firstName: 'Anna', lastName: 'Petrova' });
      const groom = await addPartner(bride.id, { firstName: 'Ivan', lastName: 'Petrov' });
      const familyId = groom.families[0]?.id;
      expect(familyId).toBeTruthy();

      const outsider = await createPerson({ firstName: 'Other', lastName: 'Family' });
      const outsiderPartner = await addPartner(outsider.id, { firstName: 'Spouse', lastName: 'Other' });
      const outsiderFamilyId = outsiderPartner.families[0]?.id;
      expect(outsiderFamilyId).toBeTruthy();

      await upsertEventRecord({
        type: 'marriage',
        familyId: familyId!,
        placeName: 'Москва',
        date: { year: 1990, precision: 'year', sortKey: 19900000 }
      });
      await upsertEventRecord({
        type: 'marriage',
        familyId: outsiderFamilyId!,
        placeName: 'Казань',
        date: { year: 2000, precision: 'year', sortKey: 20000000 }
      });
      await upsertEventRecord({
        type: 'education',
        personId: bride.id,
        placeName: 'МГУ',
        date: { year: 1988, precision: 'year', sortKey: 19880000 }
      });

      const detail = await getPersonDetail(bride.id);
      expect(detail).toBeTruthy();
      expect(detail!.events.some((e) => e.type === 'marriage' && e.placeName === 'Москва')).toBe(true);
      expect(detail!.events.some((e) => e.type === 'education' && e.placeName === 'МГУ')).toBe(true);
      expect(detail!.events.some((e) => e.placeName === 'Казань')).toBe(false);

      const groomDetail = await getPersonDetail(groom.id);
      expect(groomDetail!.events.some((e) => e.type === 'marriage' && e.placeName === 'Москва')).toBe(true);
      expect(groomDetail!.events.some((e) => e.placeName === 'Казань')).toBe(false);
    } finally {
      project.cleanup();
    }
  });
});
