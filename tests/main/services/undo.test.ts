import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestProjectDir } from '../../helpers/project-fixture';
import { isSqliteAvailable } from '../../helpers/sqlite-available';
import { closeProject } from '@main/services/project';
import { createPerson, deletePerson, getPersonDetail, updatePerson, upsertEventRecord } from '@main/services/people';
import { addChildToPerson, addPartner, getFamiliesForPerson, unlinkPartner } from '@main/services/family';
import { createCitation, createSource, deleteCitation, listCitationsForPerson } from '@main/services/sources';
import { canUndo, clearUndo, getUndoStackLength, performUndo, recordUndo } from '@main/services/undo';

vi.mock('@main/services/settings', () => ({
  getDeviceMeta: () => ({ deviceId: 'test-device', label: 'tester' }),
  getSettings: () => ({
    deviceId: 'test-device',
    editorLabel: 'tester',
    backupOnQuit: false,
    backupKeepCount: 10,
    recentProjects: [],
    onboardingComplete: true,
    backupFolder: '/tmp/fgtree-backups'
  }),
  addRecentProject: vi.fn(),
  pruneRecentProjects: vi.fn(),
  assertOnboardingComplete: () => undefined
}));

describe('undo stack', () => {
  afterEach(() => {
    clearUndo();
  });

  it('tracks undo availability and enforces stack limit', () => {
    expect(canUndo()).toBe(false);
    expect(getUndoStackLength()).toBe(0);

    recordUndo({ type: 'person-undelete', id: 'p1' });
    expect(canUndo()).toBe(true);

    for (let i = 2; i <= 6; i++) {
      recordUndo({ type: 'person-undelete', id: `p${i}` });
    }

    expect(getUndoStackLength()).toBe(5);
    clearUndo();
    expect(canUndo()).toBe(false);
  });
});

describe.skipIf(!isSqliteAvailable())('performUndo from service writes', () => {
  afterEach(() => {
    clearUndo();
    closeProject();
  });

  it('restores a person update recorded by updatePerson', async () => {
    const project = createTestProjectDir();
    try {
      const person = await createPerson({ firstName: 'Ivan', lastName: 'Ivanov' });
      clearUndo();
      await updatePerson({ id: person.id, firstName: 'Petr' });
      expect(canUndo()).toBe(true);

      await performUndo();

      const detail = await getPersonDetail(person.id);
      expect(detail?.firstName).toBe('Ivan');
    } finally {
      project.cleanup();
    }
  });

  it('undeletes a person and restores a deleted citation', async () => {
    const project = createTestProjectDir();
    try {
      const person = await createPerson({ firstName: 'Anna', lastName: 'Petrova' });
      clearUndo();
      await deletePerson(person.id);
      await performUndo();
      expect(await getPersonDetail(person.id)).toBeTruthy();

      clearUndo();
      const source = await createSource({ title: 'Archive' });
      const citation = await createCitation({ personId: person.id, sourceId: source.id, excerpt: 'Line 1' });
      clearUndo();
      await deleteCitation(citation.id);
      expect(await listCitationsForPerson(person.id)).toHaveLength(0);

      await performUndo();
      expect(await listCitationsForPerson(person.id)).toHaveLength(1);
    } finally {
      project.cleanup();
    }
  });

  it('relinks an unlinked partner and undoes a new event', async () => {
    const project = createTestProjectDir();
    try {
      const person = await createPerson({ firstName: 'Parent', lastName: 'One' });
      clearUndo();
      const partner = await addPartner(person.id, { firstName: 'Partner', lastName: 'Two' });
      const family = (await getFamiliesForPerson(person.id))[0];

      clearUndo();
      await unlinkPartner(family.id, partner.id);
      expect((await getFamiliesForPerson(person.id))[0].partners).toHaveLength(1);

      await performUndo();
      expect((await getFamiliesForPerson(person.id))[0].partners.map((p) => p.id).sort()).toEqual([person.id, partner.id].sort());

      clearUndo();
      const event = await upsertEventRecord({
        personId: person.id,
        type: 'occupation',
        customLabel: 'Teacher',
        date: { year: 1900, precision: 'year', sortKey: 1900 }
      });

      await performUndo();

      const detail = await getPersonDetail(person.id);
      expect(detail?.events.some((e) => e.id === event.id)).toBe(false);
    } finally {
      project.cleanup();
    }
  });

  it('undoes addPartner as a single step', async () => {
    const project = createTestProjectDir();
    try {
      const person = await createPerson({ firstName: 'Alex', lastName: 'Root' });
      clearUndo();
      const partner = await addPartner(person.id, { firstName: 'Sam', lastName: 'Spouse' });
      expect(getUndoStackLength()).toBe(1);

      await performUndo();

      expect(await getPersonDetail(partner.id)).toBeNull();
      const families = await getFamiliesForPerson(person.id);
      expect(families.some((f) => f.partners.some((p) => p.id === partner.id))).toBe(false);
      expect(canUndo()).toBe(false);
    } finally {
      project.cleanup();
    }
  });

  it('undoes addChildToPerson as a single step', async () => {
    const project = createTestProjectDir();
    try {
      const person = await createPerson({ firstName: 'Alex', lastName: 'Root' });
      await addPartner(person.id, { firstName: 'Sam', lastName: 'Spouse' });
      const familyId = (await getFamiliesForPerson(person.id))[0]!.id;
      clearUndo();
      const child = await addChildToPerson(person.id, { firstName: 'Kid', lastName: 'Root' }, 'birth', familyId);
      expect(getUndoStackLength()).toBe(1);

      await performUndo();

      expect(await getPersonDetail(child.id)).toBeNull();
      const families = await getFamiliesForPerson(person.id);
      expect(families.some((f) => f.children.some((c) => c.person.id === child.id))).toBe(false);
    } finally {
      project.cleanup();
    }
  });
});
