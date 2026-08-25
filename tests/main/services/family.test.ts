import { afterEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestProjectDir } from '../../helpers/project-fixture';
import { isSqliteAvailable } from '../../helpers/sqlite-available';
import { getDatabase } from '@main/db/connection';
import * as schema from '@main/db/schema';
import { closeProject } from '@main/services/project';
import { createPerson } from '@main/services/people';
import {
  addChildToPerson,
  addPartner,
  addParents,
  addSibling,
  dissolveUnion,
  getFamiliesForPerson,
  linkExistingPartner,
  linkExistingSibling,
  setUnionType,
  unlinkChild,
  unlinkPartner
} from '@main/services/family';

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

describe.skipIf(!isSqliteAvailable())('family service', () => {
  afterEach(() => {
    closeProject();
  });

  it('adds a partner to a new marriage family', async () => {
    const project = createTestProjectDir();
    try {
      const person = await createPerson({ firstName: 'Ivan', lastName: 'Ivanov' });
      const partner = await addPartner(person.id, { firstName: 'Maria', lastName: 'Ivanova' });

      const families = await getFamiliesForPerson(person.id);
      expect(families).toHaveLength(1);
      expect(families[0].partners.map((p) => p.id).sort()).toEqual([person.id, partner.id].sort());
    } finally {
      project.cleanup();
    }
  });

  it('adds a child under the parent family', async () => {
    const project = createTestProjectDir();
    try {
      const parent = await createPerson({ firstName: 'Parent', lastName: 'One' });
      const child = await addChildToPerson(parent.id, { firstName: 'Child', lastName: 'One' });

      const families = await getFamiliesForPerson(parent.id);
      expect(families[0].children.map((c) => c.person.id)).toContain(child.id);
    } finally {
      project.cleanup();
    }
  });

  it('places siblings in the same family', async () => {
    const project = createTestProjectDir();
    try {
      const first = await createPerson({ firstName: 'First', lastName: 'Sibling' });
      const second = await addSibling(first.id, { firstName: 'Second', lastName: 'Sibling' });

      const families = await getFamiliesForPerson(first.id);
      expect(families[0].children.map((c) => c.person.id).sort()).toEqual([first.id, second.id].sort());
    } finally {
      project.cleanup();
    }
  });

  it('links an existing person as sibling', async () => {
    const project = createTestProjectDir();
    try {
      const first = await createPerson({ firstName: 'Anna', lastName: 'A' });
      const second = await createPerson({ firstName: 'Boris', lastName: 'B' });
      await linkExistingSibling(first.id, second.id);

      const families = await getFamiliesForPerson(first.id);
      expect(families[0].children.map((c) => c.person.id).sort()).toEqual([first.id, second.id].sort());
    } finally {
      project.cleanup();
    }
  });

  it('rejects linking a person as their own partner or sibling', async () => {
    const project = createTestProjectDir();
    try {
      const person = await createPerson({ firstName: 'Solo', lastName: 'Person' });
      await expect(linkExistingPartner(person.id, person.id)).rejects.toThrow('с самим собой');
      await expect(linkExistingSibling(person.id, person.id)).rejects.toThrow('своим братом или сестрой');
    } finally {
      project.cleanup();
    }
  });

  it('rejects duplicate partner links', async () => {
    const project = createTestProjectDir();
    try {
      const person = await createPerson({ firstName: 'One', lastName: 'Person' });
      const partner = await createPerson({ firstName: 'Two', lastName: 'Person' });
      await linkExistingPartner(person.id, partner.id);
      await expect(linkExistingPartner(person.id, partner.id)).rejects.toThrow('уже супруги');
    } finally {
      project.cleanup();
    }
  });

  it('soft-unlinks a partner from a family', async () => {
    const project = createTestProjectDir();
    try {
      const person = await createPerson({ firstName: 'Alex', lastName: 'A' });
      const partner = await addPartner(person.id, { firstName: 'Nina', lastName: 'B' });
      const familyId = (await getFamiliesForPerson(person.id))[0].id;

      await unlinkPartner(familyId, partner.id);
      const after = await getFamiliesForPerson(person.id);
      expect(after[0].partners.map((p) => p.id)).toEqual([person.id]);
    } finally {
      project.cleanup();
    }
  });

  it('unlinks self as child and removes empty parent family', async () => {
    const project = createTestProjectDir();
    try {
      const child = await createPerson({ firstName: 'Kid', lastName: 'A' });
      await addParents(child.id, [{ firstName: 'Parent', lastName: 'A' }]);
      const familyId = (await getFamiliesForPerson(child.id))[0].id;

      await unlinkChild(familyId, child.id);
      expect(await getFamiliesForPerson(child.id)).toEqual([]);
    } finally {
      project.cleanup();
    }
  });

  it('unlinks self as partner from a union with children', async () => {
    const project = createTestProjectDir();
    try {
      const person = await createPerson({ firstName: 'Alex', lastName: 'A' });
      const partner = await addPartner(person.id, { firstName: 'Nina', lastName: 'B' });
      const child = await addChildToPerson(person.id, { firstName: 'Kid', lastName: 'A' });
      const familyId = (await getFamiliesForPerson(person.id))[0].id;

      await unlinkPartner(familyId, person.id);
      expect(await getFamiliesForPerson(person.id)).toEqual([]);
      const partnerFamilies = await getFamiliesForPerson(partner.id);
      expect(partnerFamilies[0].partners.map((p) => p.id)).toEqual([partner.id]);
      expect(partnerFamilies[0].children.map((c) => c.person.id)).toContain(child.id);
    } finally {
      project.cleanup();
    }
  });

  it('rejects unlink when link is missing', async () => {
    const project = createTestProjectDir();
    try {
      const person = await createPerson({ firstName: 'Alex', lastName: 'A' });
      await addPartner(person.id, { firstName: 'Nina', lastName: 'B' });
      const familyId = (await getFamiliesForPerson(person.id))[0].id;

      await unlinkPartner(familyId, person.id);
      await expect(unlinkPartner(familyId, person.id)).rejects.toThrow('не найдена');
    } finally {
      project.cleanup();
    }
  });

  it('clears union type to unknown', async () => {
    const project = createTestProjectDir();
    try {
      const person = await createPerson({ firstName: 'Alex', lastName: 'A' });
      await addPartner(person.id, { firstName: 'Nina', lastName: 'B' });
      const familyId = (await getFamiliesForPerson(person.id))[0].id;

      await setUnionType(familyId, 'unknown');
      const after = await getFamiliesForPerson(person.id);
      expect(after[0].unionType).toBe('unknown');
    } finally {
      project.cleanup();
    }
  });

  it('dissolves a childless union', async () => {
    const project = createTestProjectDir();
    try {
      const person = await createPerson({ firstName: 'Alex', lastName: 'A' });
      await addPartner(person.id, { firstName: 'Nina', lastName: 'B' });
      const familyId = (await getFamiliesForPerson(person.id))[0].id;

      await dissolveUnion(familyId, person.id);
      expect(await getFamiliesForPerson(person.id)).toEqual([]);
    } finally {
      project.cleanup();
    }
  });

  it('dissolves union with only deleted-child links', async () => {
    const project = createTestProjectDir();
    try {
      const person = await createPerson({ firstName: 'Alex', lastName: 'A' });
      const child = await addChildToPerson(person.id, { firstName: 'Kid', lastName: 'A' });
      const familyId = (await getFamiliesForPerson(person.id))[0].id;

      const db = getDatabase();
      const ts = new Date().toISOString();
      await db.update(schema.people).set({ deletedAt: ts, updatedAt: ts }).where(eq(schema.people.id, child.id));

      expect((await getFamiliesForPerson(person.id))[0].children).toEqual([]);
      await dissolveUnion(familyId, person.id);
      expect(await getFamiliesForPerson(person.id)).toEqual([]);
    } finally {
      project.cleanup();
    }
  });
});
