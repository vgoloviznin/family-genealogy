import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { dialog } from 'electron';
import { createTestProjectDir } from '../../helpers/project-fixture';
import { isSqliteAvailable } from '../../helpers/sqlite-available';
import { closeProject, openProjectAtPath } from '@main/services/project';
import { createPerson, getPersonDetail } from '@main/services/people';
import { addMedia, assertMediaFileSize, deleteMedia, getThumbUrls, listMediaForPerson, MAX_MEDIA_BYTES, mediaUrl, resolveMediaPath } from '@main/services/media';

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

const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

function writeTinyPng(path: string): void {
  writeFileSync(path, TINY_PNG);
}

describe('media helpers', () => {
  it('builds encoded media URLs', () => {
    expect(mediaUrl('media/photo one.jpg')).toBe('family-media://project/media/photo%20one.jpg');
  });

  it('rejects files over 50MB', () => {
    expect(() => assertMediaFileSize(MAX_MEDIA_BYTES + 1)).toThrow();
    expect(() => assertMediaFileSize(1024)).not.toThrow();
  });
});

describe.skipIf(!isSqliteAvailable())('media service', () => {
  afterEach(() => {
    closeProject();
    vi.mocked(dialog.showOpenDialog).mockReset();
  });

  it('imports, lists, thumbnails and deletes person media', async () => {
    const project = createTestProjectDir();
    const sourcePath = join(project.path, 'source.png');
    writeTinyPng(sourcePath);

    try {
      openProjectAtPath(project.path);
      const person = await createPerson({ firstName: 'Photo', lastName: 'Owner' });

      vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
        canceled: false,
        filePaths: [sourcePath]
      });

      const imported = await addMedia({ personId: person.id, imagesOnly: true, setPrimary: true });
      expect(imported).toHaveLength(1);
      expect(imported[0].mimeType).toBe('image/png');
      expect(imported[0].isPrimary).toBe(true);

      const listed = await listMediaForPerson(person.id);
      expect(listed).toHaveLength(1);
      expect(listed[0].fileName).toBe('source.png');

      const thumbs = await getThumbUrls([imported[0].id]);
      expect(thumbs.get(imported[0].id)).toMatch(/^family-media:\/\/project\/thumbs\/.+\.webp$/);

      const detailBeforeDelete = await getPersonDetail(person.id);
      const mediaPath = join(project.path, 'media', `${imported[0].id}.png`);
      expect(existsSync(mediaPath)).toBe(true);

      await deleteMedia(imported[0].id);

      expect(existsSync(mediaPath)).toBe(false);
      expect(await listMediaForPerson(person.id)).toHaveLength(0);
      expect((await getPersonDetail(person.id))?.primaryPhotoId).toBe(detailBeforeDelete?.primaryPhotoId);
    } finally {
      project.cleanup();
    }
  });

  it('resolves media paths safely within the project', async () => {
    const project = createTestProjectDir();
    const sourcePath = join(project.path, 'source.png');
    writeTinyPng(sourcePath);

    try {
      openProjectAtPath(project.path);
      const person = await createPerson({ firstName: 'Safe', lastName: 'Path' });

      vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
        canceled: false,
        filePaths: [sourcePath]
      });

      const [item] = await addMedia({ personId: person.id, imagesOnly: true });
      const relativePath = `media/${item.id}.png`;

      expect(resolveMediaPath(relativePath)).toBe(join(project.path, relativePath));
      expect(resolveMediaPath('../outside.png')).toBeNull();
      expect(resolveMediaPath('missing/file.png')).toBeNull();

      // sibling directory sharing path prefix must not resolve
      const evilDir = join(project.path + '-evil');
      mkdirSync(evilDir, { recursive: true });
      writeFileSync(join(evilDir, 'secret.png'), TINY_PNG);
      expect(resolveMediaPath(`../${project.path.split(/[/\\]/).pop()}-evil/secret.png`)).toBeNull();
    } finally {
      project.cleanup();
    }
  });

  it('returns empty result when file dialog is cancelled', async () => {
    const project = createTestProjectDir();
    try {
      openProjectAtPath(project.path);
      const person = await createPerson({ firstName: 'Empty', lastName: 'Media' });

      vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({ canceled: true, filePaths: [] });

      expect(await addMedia({ personId: person.id })).toEqual([]);
      expect(await listMediaForPerson(person.id)).toEqual([]);
    } finally {
      project.cleanup();
    }
  });
});
