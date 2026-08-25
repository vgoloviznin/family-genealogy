import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'crypto';
import { eq } from 'drizzle-orm';
import { join } from 'path';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { createForkedTestProject, createTestProjectDir } from '../../helpers/project-fixture';
import { isSqliteAvailable } from '../../helpers/sqlite-available';
import { getDatabase, getSqlite, openStandaloneDatabase } from '@main/db/connection';
import * as schema from '@main/db/schema';
import { SCHEMA_VERSION } from '@main/db/schema';
import { closeProject } from '@main/services/project';
import { createPerson, listPeople, updatePerson, deletePerson } from '@main/services/people';
import { addChildToPerson, getFamiliesForPerson } from '@main/services/family';
import { upsertEventRecord, upsertPlaceByName } from '@main/services/people';
import { mergeIncomingDatabase } from '@main/services/merge';
import { newId } from '@main/utils/id';
import type Database from 'better-sqlite3';

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

function insertMediaAsset(
  db: Database.Database,
  input: {
    id: string;
    relativePath: string;
    fileName: string;
    contentHash: string;
    fileSize: number;
    thumbRelativePath?: string | null;
    updatedAt?: string;
  }
): void {
  const ts = input.updatedAt ?? '2024-06-01T00:00:00.000Z';
  db.prepare(
    `INSERT INTO media_assets (
      id, relative_path, file_name, mime_type, content_hash, file_size,
      thumb_relative_path, created_at, updated_at
    ) VALUES (?, ?, ?, 'image/jpeg', ?, ?, ?, ?, ?)`
  ).run(input.id, input.relativePath, input.fileName, input.contentHash, input.fileSize, input.thumbRelativePath ?? null, ts, ts);
}

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

function withForkDb(forkPath: string, fn: (db: Database.Database) => void): void {
  const db = openStandaloneDatabase(join(forkPath, 'family.sqlite'));
  try {
    fn(db);
  } finally {
    db.close();
  }
}

function setPersonNotes(db: Database.Database, id: string, notes: string, updatedAt: string): void {
  db.prepare('UPDATE people SET notes = ?, updated_at = ? WHERE id = ?').run(notes, updatedAt, id);
}

function softDeletePerson(db: Database.Database, id: string, deletedAt: string, updatedAt: string): void {
  db.prepare('UPDATE people SET deleted_at = ?, updated_at = ? WHERE id = ?').run(deletedAt, updatedAt, id);
}

describe.skipIf(!isSqliteAvailable())('mergeIncomingDatabase', () => {
  afterEach(() => {
    closeProject();
  });

  it('inserts a person created only on remote', async () => {
    const local = createTestProjectDir();
    try {
      await createPerson({ firstName: 'Local', lastName: 'One' });
      const fork = createForkedTestProject(local.path);
      try {
        const remoteId = newId();
        withForkDb(fork.path, (db) => {
          const ts = '2024-06-01T00:00:00.000Z';
          db.prepare(
            `INSERT INTO people (id, first_name, last_name, sex, is_living, created_at, updated_at)
             VALUES (?, 'Remote', 'Two', 'unknown', 1, ?, ?)`
          ).run(remoteId, ts, ts);
        });

        const result = await mergeIncomingDatabase({
          localProjectPath: local.path,
          incomingProjectPath: fork.path,
          mode: 'apply'
        });

        expect(result).toMatchObject({ applied: true });
        if (!('applied' in result)) {
          throw new Error('expected apply result');
        }
        expect(result.stats.people?.inserted).toBe(1);

        const people = await listPeople();
        expect(people.map((p) => p.id)).toContain(remoteId);
        expect(people.find((p) => p.id === remoteId)?.firstName).toBe('Remote');
      } finally {
        fork.cleanup();
      }
    } finally {
      local.cleanup();
    }
  });

  it('keeps local notes when local updated_at is newer (LWW)', async () => {
    const local = createTestProjectDir();
    try {
      const person = await createPerson({ firstName: 'Ann', lastName: 'Smith' });
      await updatePerson({ id: person.id, notes: 'local-notes' });
      getSqlite().prepare('UPDATE people SET updated_at = ? WHERE id = ?').run('2025-01-01T00:00:00.000Z', person.id);

      const fork = createForkedTestProject(local.path);
      try {
        withForkDb(fork.path, (db) => {
          setPersonNotes(db, person.id, 'remote-notes', '2024-01-01T00:00:00.000Z');
        });

        await mergeIncomingDatabase({
          localProjectPath: local.path,
          incomingProjectPath: fork.path,
          mode: 'apply'
        });

        const [row] = await getDatabase().select().from(schema.people).where(eq(schema.people.id, person.id));
        expect(row.notes).toBe('local-notes');
      } finally {
        fork.cleanup();
      }
    } finally {
      local.cleanup();
    }
  });

  it('takes remote notes when remote updated_at is newer (LWW)', async () => {
    const local = createTestProjectDir();
    try {
      const person = await createPerson({ firstName: 'Ann', lastName: 'Smith' });
      await updatePerson({ id: person.id, notes: 'local-notes' });
      getSqlite().prepare('UPDATE people SET updated_at = ? WHERE id = ?').run('2024-01-01T00:00:00.000Z', person.id);

      const fork = createForkedTestProject(local.path);
      try {
        withForkDb(fork.path, (db) => {
          setPersonNotes(db, person.id, 'remote-notes', '2025-06-01T00:00:00.000Z');
        });

        const result = await mergeIncomingDatabase({
          localProjectPath: local.path,
          incomingProjectPath: fork.path,
          mode: 'apply'
        });
        if (!('applied' in result)) {
          throw new Error('expected apply');
        }
        expect(result.stats.people?.tookRemote).toBe(1);

        const [row] = await getDatabase().select().from(schema.people).where(eq(schema.people.id, person.id));
        expect(row.notes).toBe('remote-notes');
      } finally {
        fork.cleanup();
      }
    } finally {
      local.cleanup();
    }
  });

  it('applies newer soft-delete from remote', async () => {
    const local = createTestProjectDir();
    try {
      const person = await createPerson({ firstName: 'Gone', lastName: 'Soon' });
      getSqlite().prepare('UPDATE people SET updated_at = ? WHERE id = ?').run('2024-01-01T00:00:00.000Z', person.id);

      const fork = createForkedTestProject(local.path);
      try {
        withForkDb(fork.path, (db) => {
          softDeletePerson(db, person.id, '2025-01-02T00:00:00.000Z', '2025-01-02T00:00:00.000Z');
        });

        await mergeIncomingDatabase({
          localProjectPath: local.path,
          incomingProjectPath: fork.path,
          mode: 'apply'
        });

        const [row] = await getDatabase().select().from(schema.people).where(eq(schema.people.id, person.id));
        expect(row.deletedAt).toBeTruthy();
        expect(await listPeople()).toHaveLength(0);
      } finally {
        fork.cleanup();
      }
    } finally {
      local.cleanup();
    }
  });

  it('revives when a newer edit beats an older tombstone', async () => {
    const local = createTestProjectDir();
    try {
      const person = await createPerson({ firstName: 'Alive', lastName: 'Again' });
      await deletePerson(person.id);
      getSqlite()
        .prepare('UPDATE people SET deleted_at = ?, updated_at = ? WHERE id = ?')
        .run('2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z', person.id);

      const fork = createForkedTestProject(local.path);
      try {
        withForkDb(fork.path, (db) => {
          db.prepare(`UPDATE people SET deleted_at = NULL, notes = ?, updated_at = ? WHERE id = ?`).run(
            'revived',
            '2025-06-01T00:00:00.000Z',
            person.id
          );
        });

        await mergeIncomingDatabase({
          localProjectPath: local.path,
          incomingProjectPath: fork.path,
          mode: 'apply'
        });

        const people = await listPeople();
        expect(people).toHaveLength(1);
        expect(people[0].notes).toBe('revived');
      } finally {
        fork.cleanup();
      }
    } finally {
      local.cleanup();
    }
  });

  it('equal updatedAt yields conflict; apply without resolution throws and leaves local unchanged', async () => {
    const local = createTestProjectDir();
    try {
      const person = await createPerson({ firstName: 'Ann', lastName: 'Smith' });
      await updatePerson({ id: person.id, notes: 'local-notes' });
      const ts = '2024-06-01T00:00:00.000Z';
      getSqlite().prepare('UPDATE people SET updated_at = ? WHERE id = ?').run(ts, person.id);

      const fork = createForkedTestProject(local.path);
      try {
        withForkDb(fork.path, (db) => {
          setPersonNotes(db, person.id, 'remote-notes', ts);
        });

        const preview = await mergeIncomingDatabase({
          localProjectPath: local.path,
          incomingProjectPath: fork.path,
          mode: 'preview'
        });
        expect('applied' in preview).toBe(false);
        expect(preview.conflicts).toHaveLength(1);
        expect(preview.conflicts[0].id).toBe(person.id);
        expect(preview.conflicts[0].detail?.fields).toEqual(
          expect.arrayContaining([{ column: 'notes', local: 'local-notes', remote: 'remote-notes' }])
        );

        await expect(
          mergeIncomingDatabase({
            localProjectPath: local.path,
            incomingProjectPath: fork.path,
            mode: 'apply'
          })
        ).rejects.toThrow('Есть неразрешённые конфликты');

        const [row] = await getDatabase().select().from(schema.people).where(eq(schema.people.id, person.id));
        expect(row.notes).toBe('local-notes');
      } finally {
        fork.cleanup();
      }
    } finally {
      local.cleanup();
    }
  });

  it('apply with resolution local and remote', async () => {
    const local = createTestProjectDir();
    try {
      const a = await createPerson({ firstName: 'A', lastName: 'One' });
      const b = await createPerson({ firstName: 'B', lastName: 'Two' });
      await updatePerson({ id: a.id, notes: 'a-local' });
      await updatePerson({ id: b.id, notes: 'b-local' });
      const ts = '2024-06-01T00:00:00.000Z';
      getSqlite().prepare('UPDATE people SET updated_at = ? WHERE id = ?').run(ts, a.id);
      getSqlite().prepare('UPDATE people SET updated_at = ? WHERE id = ?').run(ts, b.id);

      const fork = createForkedTestProject(local.path);
      try {
        withForkDb(fork.path, (db) => {
          setPersonNotes(db, a.id, 'a-remote', ts);
          setPersonNotes(db, b.id, 'b-remote', ts);
        });

        const result = await mergeIncomingDatabase({
          localProjectPath: local.path,
          incomingProjectPath: fork.path,
          mode: 'apply',
          resolutions: [
            { table: 'people', id: a.id, choice: 'local' },
            { table: 'people', id: b.id, choice: 'remote' }
          ]
        });
        if (!('applied' in result)) {
          throw new Error('expected apply');
        }
        expect(result.conflictsResolved).toBe(2);

        const [rowA] = await getDatabase().select().from(schema.people).where(eq(schema.people.id, a.id));
        const [rowB] = await getDatabase().select().from(schema.people).where(eq(schema.people.id, b.id));
        expect(rowA.notes).toBe('a-local');
        expect(rowB.notes).toBe('b-remote');
      } finally {
        fork.cleanup();
      }
    } finally {
      local.cleanup();
    }
  });

  it('merges two children from different sides into one family', async () => {
    const local = createTestProjectDir();
    try {
      const parent = await createPerson({ firstName: 'Parent', lastName: 'P' });
      const localChild = await addChildToPerson(parent.id, { firstName: 'LocalKid', lastName: 'P' });
      const familyId = (await getFamiliesForPerson(parent.id))[0].id;

      const fork = createForkedTestProject(local.path);
      try {
        const remoteChildId = newId();
        const remoteLinkId = newId();
        withForkDb(fork.path, (db) => {
          const ts = '2024-07-01T00:00:00.000Z';
          db.prepare(
            `INSERT INTO people (id, first_name, last_name, sex, is_living, created_at, updated_at)
             VALUES (?, 'RemoteKid', 'P', 'unknown', 1, ?, ?)`
          ).run(remoteChildId, ts, ts);
          db.prepare(
            `INSERT INTO family_children (id, family_id, person_id, pedigree, created_at, updated_at)
             VALUES (?, ?, ?, 'birth', ?, ?)`
          ).run(remoteLinkId, familyId, remoteChildId, ts, ts);
        });

        await mergeIncomingDatabase({
          localProjectPath: local.path,
          incomingProjectPath: fork.path,
          mode: 'apply'
        });

        const families = await getFamiliesForPerson(parent.id);
        const childIds = families[0].children.map((c) => c.person.id).sort();
        expect(childIds).toEqual([localChild.id, remoteChildId].sort());
      } finally {
        fork.cleanup();
      }
    } finally {
      local.cleanup();
    }
  });

  it('dedupes places by normalized_name and remaps event place_id', async () => {
    const local = createTestProjectDir();
    try {
      const person = await createPerson({ firstName: 'Ivan', lastName: 'I' });
      const localPlaceId = await upsertPlaceByName('Moscow');
      await upsertEventRecord({
        type: 'residence',
        personId: person.id,
        placeName: 'Moscow',
        date: { precision: 'year', year: 2000 }
      });

      const fork = createForkedTestProject(local.path);
      try {
        const remotePlaceId = newId();
        const remoteEventId = newId();
        withForkDb(fork.path, (db) => {
          const ts = '2024-08-01T00:00:00.000Z';
          db.prepare(
            `INSERT INTO places (id, name, normalized_name, created_at, updated_at)
             VALUES (?, 'Москва', 'moscow', ?, ?)`
          ).run(remotePlaceId, ts, ts);
          db.prepare(
            `INSERT INTO events (
              id, type, person_id, place_id, date_precision, created_at, updated_at
            ) VALUES (?, 'other', ?, ?, 'unknown', ?, ?)`
          ).run(remoteEventId, person.id, remotePlaceId, ts, ts);
        });

        const result = await mergeIncomingDatabase({
          localProjectPath: local.path,
          incomingProjectPath: fork.path,
          mode: 'apply'
        });
        if (!('applied' in result)) {
          throw new Error('expected apply');
        }
        expect(result.placeRemap?.[remotePlaceId]).toBe(localPlaceId);

        const places = getSqlite().prepare('SELECT id FROM places WHERE deleted_at IS NULL').all() as Array<{
          id: string;
        }>;
        expect(places.map((p) => p.id)).toContain(localPlaceId);
        expect(places.map((p) => p.id)).not.toContain(remotePlaceId);

        const event = getSqlite().prepare('SELECT place_id FROM events WHERE id = ?').get(remoteEventId) as { place_id: string };
        expect(event.place_id).toBe(localPlaceId);
      } finally {
        fork.cleanup();
      }
    } finally {
      local.cleanup();
    }
  });

  it('throws when incoming projectId differs', async () => {
    const local = createTestProjectDir();
    try {
      await createPerson({ firstName: 'X', lastName: 'Y' });
      const fork = createForkedTestProject(local.path);
      try {
        writeFileSync(
          join(fork.path, 'project.json'),
          JSON.stringify({
            projectId: newId(),
            name: 'Other',
            schemaVersion: 3,
            createdAt: '2020-01-01T00:00:00.000Z'
          }),
          'utf-8'
        );

        await expect(
          mergeIncomingDatabase({
            localProjectPath: local.path,
            incomingProjectPath: fork.path,
            mode: 'preview'
          })
        ).rejects.toThrow('Это архив другого проекта');
      } finally {
        fork.cleanup();
      }
    } finally {
      local.cleanup();
    }
  });

  it('is idempotent on a second apply of the same incoming db', async () => {
    const local = createTestProjectDir();
    try {
      await createPerson({ firstName: 'Local', lastName: 'One' });
      const fork = createForkedTestProject(local.path);
      try {
        const remoteId = newId();
        withForkDb(fork.path, (db) => {
          const ts = '2024-06-01T00:00:00.000Z';
          db.prepare(
            `INSERT INTO people (id, first_name, last_name, sex, is_living, created_at, updated_at)
             VALUES (?, 'Remote', 'Two', 'unknown', 1, ?, ?)`
          ).run(remoteId, ts, ts);
        });

        await mergeIncomingDatabase({
          localProjectPath: local.path,
          incomingProjectPath: fork.path,
          mode: 'apply'
        });

        const second = await mergeIncomingDatabase({
          localProjectPath: local.path,
          incomingProjectPath: fork.path,
          mode: 'apply'
        });
        if (!('applied' in second)) {
          throw new Error('expected apply');
        }
        expect(second.stats.people?.inserted ?? 0).toBe(0);
        expect(second.stats.people?.tookRemote ?? 0).toBe(0);
        expect(await listPeople()).toHaveLength(2);
      } finally {
        fork.cleanup();
      }
    } finally {
      local.cleanup();
    }
  });

  it('applies primary_photo_id after media_assets exist', async () => {
    const local = createTestProjectDir();
    try {
      const person = await createPerson({ firstName: 'Photo', lastName: 'Person' });
      getSqlite().prepare('UPDATE people SET updated_at = ? WHERE id = ?').run('2024-01-01T00:00:00.000Z', person.id);

      const fork = createForkedTestProject(local.path);
      try {
        const mediaId = newId();
        withForkDb(fork.path, (db) => {
          const ts = '2025-01-01T00:00:00.000Z';
          db.prepare(
            `INSERT INTO media_assets (
              id, relative_path, file_name, mime_type, content_hash, file_size,
              created_at, updated_at
            ) VALUES (?, 'media/x.jpg', 'x.jpg', 'image/jpeg', 'abc', 10, ?, ?)`
          ).run(mediaId, ts, ts);
          db.prepare(`UPDATE people SET primary_photo_id = ?, updated_at = ? WHERE id = ?`).run(mediaId, ts, person.id);
        });

        await mergeIncomingDatabase({
          localProjectPath: local.path,
          incomingProjectPath: fork.path,
          mode: 'apply'
        });

        const media = getSqlite().prepare('SELECT id FROM media_assets WHERE id = ?').get(mediaId) as { id: string } | undefined;
        expect(media?.id).toBe(mediaId);

        const [row] = await getDatabase().select().from(schema.people).where(eq(schema.people.id, person.id));
        expect(row.primaryPhotoId).toBe(mediaId);
      } finally {
        fork.cleanup();
      }
    } finally {
      local.cleanup();
    }
  });

  it('copies remote media file with unique hash into local media/', async () => {
    const local = createTestProjectDir();
    try {
      await createPerson({ firstName: 'Local', lastName: 'One' });
      const fork = createForkedTestProject(local.path);
      try {
        const mediaId = newId();
        const bytes = Buffer.from('unique-remote-photo-bytes');
        const hash = sha256(bytes);
        const relativePath = `media/${mediaId}.jpg`;
        mkdirSync(join(fork.path, 'media'), { recursive: true });
        writeFileSync(join(fork.path, relativePath), bytes);
        withForkDb(fork.path, (db) => {
          insertMediaAsset(db, {
            id: mediaId,
            relativePath,
            fileName: `${mediaId}.jpg`,
            contentHash: hash,
            fileSize: bytes.length
          });
        });

        const result = await mergeIncomingDatabase({
          localProjectPath: local.path,
          incomingProjectPath: fork.path,
          mode: 'apply'
        });
        if (!('applied' in result)) {
          throw new Error('expected apply');
        }
        expect(result.mediaCopied).toBe(1);
        expect(existsSync(join(local.path, relativePath))).toBe(true);
      } finally {
        fork.cleanup();
      }
    } finally {
      local.cleanup();
    }
  });

  it('skips copy when same content_hash already exists locally', async () => {
    const local = createTestProjectDir();
    try {
      const localMediaId = newId();
      const bytes = Buffer.from('shared-photo-content');
      const hash = sha256(bytes);
      const localRel = `media/${localMediaId}.jpg`;
      writeFileSync(join(local.path, localRel), bytes);
      insertMediaAsset(getSqlite(), {
        id: localMediaId,
        relativePath: localRel,
        fileName: `${localMediaId}.jpg`,
        contentHash: hash,
        fileSize: bytes.length
      });

      const fork = createForkedTestProject(local.path);
      try {
        const remoteMediaId = newId();
        const remoteRel = `media/${remoteMediaId}.jpg`;
        mkdirSync(join(fork.path, 'media'), { recursive: true });
        writeFileSync(join(fork.path, remoteRel), bytes);
        withForkDb(fork.path, (db) => {
          insertMediaAsset(db, {
            id: remoteMediaId,
            relativePath: remoteRel,
            fileName: `${remoteMediaId}.jpg`,
            contentHash: hash,
            fileSize: bytes.length
          });
        });

        const before = readdirSync(join(local.path, 'media')).sort();
        const result = await mergeIncomingDatabase({
          localProjectPath: local.path,
          incomingProjectPath: fork.path,
          mode: 'apply'
        });
        if (!('applied' in result)) {
          throw new Error('expected apply');
        }
        expect(result.mediaSkipped).toBeGreaterThanOrEqual(1);
        expect(result.mediaCopied).toBe(0);
        expect(readdirSync(join(local.path, 'media')).sort()).toEqual(before);
        expect(existsSync(join(local.path, remoteRel))).toBe(false);
      } finally {
        fork.cleanup();
      }
    } finally {
      local.cleanup();
    }
  });

  it('renames on path collision when hashes differ and keeps both files', async () => {
    const local = createTestProjectDir();
    try {
      const localMediaId = newId();
      const localBytes = Buffer.from('local-file-at-shared-path');
      const localHash = sha256(localBytes);
      const sharedRel = 'media/shared.jpg';
      writeFileSync(join(local.path, sharedRel), localBytes);
      insertMediaAsset(getSqlite(), {
        id: localMediaId,
        relativePath: sharedRel,
        fileName: 'shared.jpg',
        contentHash: localHash,
        fileSize: localBytes.length
      });

      const fork = createForkedTestProject(local.path);
      try {
        const remoteMediaId = newId();
        const remoteBytes = Buffer.from('remote-different-bytes-here');
        const remoteHash = sha256(remoteBytes);
        mkdirSync(join(fork.path, 'media'), { recursive: true });
        writeFileSync(join(fork.path, sharedRel), remoteBytes);
        withForkDb(fork.path, (db) => {
          insertMediaAsset(db, {
            id: remoteMediaId,
            relativePath: sharedRel,
            fileName: 'shared.jpg',
            contentHash: remoteHash,
            fileSize: remoteBytes.length
          });
        });

        const result = await mergeIncomingDatabase({
          localProjectPath: local.path,
          incomingProjectPath: fork.path,
          mode: 'apply'
        });
        if (!('applied' in result)) {
          throw new Error('expected apply');
        }
        expect(result.mediaCopied).toBe(1);

        const remoteRow = getSqlite().prepare('SELECT relative_path, content_hash FROM media_assets WHERE id = ?').get(remoteMediaId) as {
          relative_path: string;
          content_hash: string;
        };
        expect(remoteRow.content_hash).toBe(remoteHash);
        expect(remoteRow.relative_path).not.toBe(sharedRel);
        expect(existsSync(join(local.path, sharedRel))).toBe(true);
        expect(existsSync(join(local.path, remoteRow.relative_path))).toBe(true);
        expect(sha256(readFileSync(join(local.path, sharedRel)))).toBe(localHash);
        expect(sha256(readFileSync(join(local.path, remoteRow.relative_path)))).toBe(remoteHash);
      } finally {
        fork.cleanup();
      }
    } finally {
      local.cleanup();
    }
  });

  it('preview reports inserts but does not write to local database', async () => {
    const local = createTestProjectDir();
    try {
      await createPerson({ firstName: 'Local', lastName: 'Only' });
      const beforeCount = (await listPeople()).length;

      const fork = createForkedTestProject(local.path);
      try {
        const remoteId = newId();
        withForkDb(fork.path, (db) => {
          const ts = '2024-06-01T00:00:00.000Z';
          db.prepare(
            `INSERT INTO people (id, first_name, last_name, sex, is_living, created_at, updated_at)
             VALUES (?, 'Remote', 'Only', 'unknown', 1, ?, ?)`
          ).run(remoteId, ts, ts);
        });

        const preview = await mergeIncomingDatabase({
          localProjectPath: local.path,
          incomingProjectPath: fork.path,
          mode: 'preview'
        });
        expect('applied' in preview).toBe(false);
        expect(preview.stats.people?.inserted).toBe(1);

        const afterCount = (await listPeople()).length;
        expect(afterCount).toBe(beforeCount);
        expect((await listPeople()).some((p) => p.firstName === 'Remote')).toBe(false);
      } finally {
        fork.cleanup();
      }
    } finally {
      local.cleanup();
    }
  });

  it('throws when incoming schemaVersion is newer than the app', async () => {
    const local = createTestProjectDir();
    try {
      const fork = createForkedTestProject(local.path);
      try {
        const json = JSON.parse(readFileSync(join(fork.path, 'project.json'), 'utf-8')) as Record<string, unknown>;
        json.schemaVersion = SCHEMA_VERSION + 1;
        writeFileSync(join(fork.path, 'project.json'), JSON.stringify(json, null, 2));

        await expect(
          mergeIncomingDatabase({
            localProjectPath: local.path,
            incomingProjectPath: fork.path,
            mode: 'preview'
          })
        ).rejects.toThrow('Архив создан в более новой версии приложения');
      } finally {
        fork.cleanup();
      }
    } finally {
      local.cleanup();
    }
  });

  it('inserts remote media_link when asset already exists on both sides', async () => {
    const local = createTestProjectDir();
    try {
      const person = await createPerson({ firstName: 'Photo', lastName: 'Owner' });
      const mediaId = newId();
      const linkId = newId();
      const ts = '2024-06-01T00:00:00.000Z';
      insertMediaAsset(getSqlite(), {
        id: mediaId,
        relativePath: 'media/photo.jpg',
        fileName: 'photo.jpg',
        contentHash: sha256(Buffer.from('photo-bytes')),
        fileSize: 11
      });

      const fork = createForkedTestProject(local.path);
      try {
        withForkDb(fork.path, (db) => {
          db.prepare(
            `INSERT INTO media_links (id, media_id, person_id, event_id, created_at)
             VALUES (?, ?, ?, NULL, ?)`
          ).run(linkId, mediaId, person.id, ts);
        });

        const result = await mergeIncomingDatabase({
          localProjectPath: local.path,
          incomingProjectPath: fork.path,
          mode: 'apply'
        });
        if (!('applied' in result)) {
          throw new Error('expected apply');
        }
        expect(result.stats.media_links?.inserted).toBe(1);

        const link = getSqlite().prepare('SELECT media_id, person_id, deleted_at FROM media_links WHERE id = ?').get(linkId) as {
          media_id: string;
          person_id: string;
          deleted_at: string | null;
        };
        expect(link.media_id).toBe(mediaId);
        expect(link.person_id).toBe(person.id);
        expect(link.deleted_at).toBeNull();
      } finally {
        fork.cleanup();
      }
    } finally {
      local.cleanup();
    }
  });
});
