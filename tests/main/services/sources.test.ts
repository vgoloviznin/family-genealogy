import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestProjectDir } from '../../helpers/project-fixture';
import { isSqliteAvailable } from '../../helpers/sqlite-available';
import { closeProject } from '@main/services/project';
import { createPerson } from '@main/services/people';
import {
  createCitation,
  createSource,
  deleteCitation,
  deleteSource,
  listCitationsForPerson,
  listSources,
  restoreCitation,
  updateSource
} from '@main/services/sources';
import { localizedErrorMessage } from '../../helpers/localized-error';

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

describe.skipIf(!isSqliteAvailable())('sources service', () => {
  afterEach(() => {
    closeProject();
  });

  it('creates, lists and updates sources', async () => {
    const project = createTestProjectDir();
    try {
      const source = await createSource({
        title: '  Метрическая книга  ',
        type: 'book',
        author: '  Священник  ',
        details: '1890–1900',
        notes: '  Архив  '
      });

      expect(source.title).toBe('Метрическая книга');
      expect(source.author).toBe('Священник');
      expect(source.details).toBe('1890–1900');
      expect(source.notes).toBe('Архив');

      const updated = await updateSource({ id: source.id, title: 'Перепись 1897', type: 'archive' });
      expect(updated.title).toBe('Перепись 1897');
      expect(updated.type).toBe('archive');

      const listed = await listSources();
      expect(listed.map((s) => s.id)).toContain(source.id);
    } finally {
      project.cleanup();
    }
  });

  it('creates citations for a person with an existing or inline source', async () => {
    const project = createTestProjectDir();
    try {
      const person = await createPerson({ firstName: 'Anna', lastName: 'Petrova' });
      const source = await createSource({ title: 'Family Bible' });

      const withExisting = await createCitation({
        personId: person.id,
        sourceId: source.id,
        page: '12',
        excerpt: 'Born 1880'
      });
      expect(withExisting.source.title).toBe('Family Bible');
      expect(withExisting.page).toBe('12');

      const withInline = await createCitation({
        personId: person.id,
        newSource: { title: 'Interview notes', type: 'oral' },
        excerpt: 'Remembers grandmother'
      });
      expect(withInline.source.title).toBe('Interview notes');

      const citations = await listCitationsForPerson(person.id);
      expect(citations).toHaveLength(2);
    } finally {
      project.cleanup();
    }
  });

  it('rejects citations without a target or source', async () => {
    const project = createTestProjectDir();
    try {
      const person = await createPerson({ firstName: 'Ivan', lastName: 'Ivanov' });

      await expect(createCitation({ personId: person.id })).rejects.toThrow(localizedErrorMessage('errors.sourceRequired'));
      await expect(createCitation({ sourceId: 'missing-source' })).rejects.toThrow(localizedErrorMessage('errors.citationNeedsSubject'));
    } finally {
      project.cleanup();
    }
  });

  it('soft-deletes sources and their citations together', async () => {
    const project = createTestProjectDir();
    try {
      const person = await createPerson({ firstName: 'Maria', lastName: 'Sidorova' });
      const source = await createSource({ title: 'Archive record' });
      const citation = await createCitation({ personId: person.id, sourceId: source.id, excerpt: 'Line 5' });

      await deleteSource(source.id);

      expect(await listSources()).toHaveLength(0);
      expect(await listCitationsForPerson(person.id)).toHaveLength(0);

      await restoreCitation(citation.id);
      expect(await listCitationsForPerson(person.id)).toHaveLength(0);

      await deleteCitation(citation.id);
      expect(await listCitationsForPerson(person.id)).toHaveLength(0);
    } finally {
      project.cleanup();
    }
  });
});
