import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestProjectDir } from '../../helpers/project-fixture';
import { isSqliteAvailable } from '../../helpers/sqlite-available';
import { closeProject } from '@main/services/project';
import { createPerson, deletePerson, getPersonDetail, updatePerson, upsertEventRecord } from '@main/services/people';
import { addPartner, getFamiliesForPerson, unlinkPartner } from '@main/services/family';
import { createCitation, createSource, deleteCitation, listCitationsForPerson } from '@main/services/sources';
import { canUndo, clearUndo, performUndo, popUndo, pushUndo } from '@main/services/undo';

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

describe('undo stack', () => {
  afterEach(() => {
    clearUndo();
  });

  it('tracks undo availability and enforces stack limit', () => {
    expect(canUndo()).toBe(false);
    expect(popUndo()).toBeNull();

    pushUndo({ type: 'person-undelete', id: 'p1' });
    expect(canUndo()).toBe(true);

    for (let i = 2; i <= 6; i++) {
      pushUndo({ type: 'person-undelete', id: `p${i}` });
    }

    expect((popUndo() as { id: string }).id).toBe('p6');
    expect((popUndo() as { id: string }).id).toBe('p5');

    clearUndo();
    expect(canUndo()).toBe(false);
  });
});

describe.skipIf(!isSqliteAvailable())('performUndo', () => {
  afterEach(() => {
    closeProject();
  });

  it('restores a person update', async () => {
    const project = createTestProjectDir();
    try {
      const person = await createPerson({ firstName: 'Ivan', lastName: 'Ivanov' });
      await updatePerson({ id: person.id, firstName: 'Petr' });

      pushUndo({ type: 'person-update', before: { id: person.id, firstName: 'Ivan' } });
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
      await deletePerson(person.id);

      pushUndo({ type: 'person-undelete', id: person.id });
      await performUndo();
      expect(await getPersonDetail(person.id)).toBeTruthy();

      const source = await createSource({ title: 'Archive' });
      const citation = await createCitation({ personId: person.id, sourceId: source.id, excerpt: 'Line 1' });
      await deleteCitation(citation.id);
      expect(await listCitationsForPerson(person.id)).toHaveLength(0);

      pushUndo({ type: 'citation-restore', id: citation.id });
      await performUndo();
      expect(await listCitationsForPerson(person.id)).toHaveLength(1);
    } finally {
      project.cleanup();
    }
  });

  it('relinks an unlinked partner and deletes a restored event on undo', async () => {
    const project = createTestProjectDir();
    try {
      const person = await createPerson({ firstName: 'Parent', lastName: 'One' });
      const partner = await addPartner(person.id, { firstName: 'Partner', lastName: 'Two' });
      const family = (await getFamiliesForPerson(person.id))[0];

      await unlinkPartner(family.id, partner.id);
      expect((await getFamiliesForPerson(person.id))[0].partners).toHaveLength(1);

      pushUndo({ type: 'family-relink-partner', familyId: family.id, personId: partner.id });
      await performUndo();
      expect((await getFamiliesForPerson(person.id))[0].partners.map((p) => p.id).sort()).toEqual([person.id, partner.id].sort());

      const event = await upsertEventRecord({
        personId: person.id,
        type: 'occupation',
        customLabel: 'Teacher',
        date: { text: '1900', sortKey: 1900 }
      });

      pushUndo({ type: 'event-delete', id: event.id });
      await performUndo();

      const detail = await getPersonDetail(person.id);
      expect(detail?.events.some((e) => e.id === event.id)).toBe(false);
    } finally {
      project.cleanup();
    }
  });
});
