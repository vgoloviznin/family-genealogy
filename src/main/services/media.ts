import { createHash } from 'crypto';
import { copyFileSync, createReadStream, existsSync, mkdirSync, statSync, unlinkSync } from 'fs';
import { join, extname, basename, resolve, sep } from 'path';
import { dialog, shell } from 'electron';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import sharp from 'sharp';
import { getDatabase } from '../db/connection';
import * as schema from '../db/schema';
import { newId, nowIso } from '../utils/id';
import { getDeviceMeta } from './settings';
import { requireProject } from './project';
import { getAppLocale, localizedError, t } from '../i18n';
import { logError } from '../utils/log';
import type { MediaItem } from '@shared/types';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

export function isPathInsideRoot(root: string, candidate: string): boolean {
  const base = resolve(root);
  const full = resolve(candidate);
  return full === base || full.startsWith(base + sep);
}

export function assertMediaFileSize(size: number): void {
  if (size > MAX_MEDIA_BYTES) {
    throw new Error(localizedError('errors.mediaTooLarge', { maxMb: 50 }));
  }
}

function hashFile(path: string): Promise<string> {
  return new Promise((resolveHash, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(path);
    stream.on('data', (d) => hash.update(d));
    stream.on('end', () => resolveHash(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.pdf': 'application/pdf'
  };
  return map[ext.toLowerCase()] ?? 'application/octet-stream';
}

export function mediaUrl(relativePath: string): string {
  const encoded = relativePath.split('/').map(encodeURIComponent).join('/');
  return `family-media://project/${encoded}`;
}

export async function getThumbUrls(mediaIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(mediaIds.filter(Boolean))];
  if (unique.length === 0) {
    return map;
  }
  const db = getDatabase();
  const rows = await db.select().from(schema.mediaAssets).where(inArray(schema.mediaAssets.id, unique));
  for (const row of rows) {
    if (row.deletedAt) {
      continue;
    }
    if (row.thumbRelativePath) {
      map.set(row.id, mediaUrl(row.thumbRelativePath));
    }
  }
  return map;
}

async function mapMediaItem(row: typeof schema.mediaAssets.$inferSelect): Promise<MediaItem> {
  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    caption: row.caption,
    description: row.description,
    takenAt: row.takenAt,
    thumbUrl: row.thumbRelativePath ? mediaUrl(row.thumbRelativePath) : undefined,
    isPrimary: false
  };
}

export async function listMediaForPerson(personId: string): Promise<MediaItem[]> {
  const db = getDatabase();
  const [person] = await db.select().from(schema.people).where(eq(schema.people.id, personId));
  const links = await db
    .select()
    .from(schema.mediaLinks)
    .where(and(eq(schema.mediaLinks.personId, personId), isNull(schema.mediaLinks.deletedAt)));

  const items: MediaItem[] = [];
  for (const link of links) {
    const [asset] = await db
      .select()
      .from(schema.mediaAssets)
      .where(and(eq(schema.mediaAssets.id, link.mediaId), isNull(schema.mediaAssets.deletedAt)));
    if (asset) {
      const item = await mapMediaItem(asset);
      item.isPrimary = person?.primaryPhotoId === asset.id;
      items.push(item);
    }
  }
  return items;
}

export async function listMediaForEvent(eventId: string): Promise<MediaItem[]> {
  const db = getDatabase();
  const links = await db
    .select()
    .from(schema.mediaLinks)
    .where(and(eq(schema.mediaLinks.eventId, eventId), isNull(schema.mediaLinks.deletedAt)));

  const items: MediaItem[] = [];
  for (const link of links) {
    const [asset] = await db
      .select()
      .from(schema.mediaAssets)
      .where(and(eq(schema.mediaAssets.id, link.mediaId), isNull(schema.mediaAssets.deletedAt)));
    if (asset) {
      items.push(await mapMediaItem(asset));
    }
  }
  return items;
}

export async function addMedia(target: {
  personId?: string;
  eventId?: string;
  imagesOnly?: boolean;
  setPrimary?: boolean;
  multiple?: boolean;
}): Promise<MediaItem[]> {
  const allowMultiple = target.multiple ?? !target.setPrimary;
  const locale = getAppLocale();
  const result = await dialog.showOpenDialog({
    title: target.imagesOnly ? t(locale, 'dialog.pickPhoto') : t(locale, 'dialog.addFiles'),
    properties: allowMultiple ? ['openFile', 'multiSelections'] : ['openFile'],
    filters: target.imagesOnly
      ? [{ name: t(locale, 'dialog.imagesFilter'), extensions: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'] }]
      : [{ name: t(locale, 'dialog.allFilesFilter'), extensions: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'pdf', 'doc', 'docx'] }]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return [];
  }

  const items: MediaItem[] = [];
  let primarySet = false;
  let skippedTooLarge = 0;
  const tooLargeMessage = localizedError('errors.mediaTooLarge', { maxMb: 50 });

  for (const sourcePath of result.filePaths) {
    try {
      const item = await importMediaFile(sourcePath, target);
      if (!item) {
        continue;
      }
      if (target.setPrimary && target.personId && !primarySet && IMAGE_TYPES.has(item.mimeType)) {
        await setPrimaryPhoto(target.personId, item.id);
        item.isPrimary = true;
        primarySet = true;
      }
      items.push(item);
    } catch (err) {
      if (err instanceof Error && err.message === tooLargeMessage) {
        skippedTooLarge += 1;
        logError('media.tooLarge', { path: sourcePath });
        continue;
      }
      throw err;
    }
  }

  if (items.length === 0 && skippedTooLarge > 0) {
    throw new Error(tooLargeMessage);
  }

  return items;
}

async function importMediaFile(sourcePath: string, target: { personId?: string; eventId?: string }): Promise<MediaItem | null> {
  const project = requireProject();
  const meta = getDeviceMeta();
  const ts = nowIso();
  const id = newId();
  const fileStat = statSync(sourcePath);
  assertMediaFileSize(fileStat.size);
  const ext = extname(sourcePath) || '.bin';
  const relativePath = join('media', `${id}${ext}`);
  const destPath = join(project.path, relativePath);
  mkdirSync(join(project.path, 'media'), { recursive: true });
  copyFileSync(sourcePath, destPath);

  const contentHash = await hashFile(destPath);
  const mimeType = mimeFromExt(ext);

  let thumbRelativePath: string | null = null;
  if (IMAGE_TYPES.has(mimeType)) {
    try {
      thumbRelativePath = join('thumbs', `${id}.webp`);
      const thumbPath = join(project.path, thumbRelativePath);
      mkdirSync(join(project.path, 'thumbs'), { recursive: true });
      await sharp(destPath).resize(320, 320, { fit: 'inside' }).webp({ quality: 80 }).toFile(thumbPath);
    } catch {
      thumbRelativePath = null;
    }
  }

  const db = getDatabase();
  await db.insert(schema.mediaAssets).values({
    id,
    relativePath,
    fileName: basename(sourcePath),
    mimeType,
    contentHash,
    fileSize: fileStat.size,
    thumbRelativePath,
    createdAt: ts,
    updatedAt: ts,
    createdByDeviceId: meta.deviceId,
    updatedByDeviceId: meta.deviceId,
    updatedByLabel: meta.label || null
  });

  await db.insert(schema.mediaLinks).values({
    id: newId(),
    mediaId: id,
    personId: target.personId ?? null,
    eventId: target.eventId ?? null,
    createdAt: ts
  });

  const [asset] = await db.select().from(schema.mediaAssets).where(eq(schema.mediaAssets.id, id));
  return asset ? await mapMediaItem(asset) : null;
}

export async function deleteMedia(id: string): Promise<void> {
  const db = getDatabase();
  const ts = nowIso();

  const links = await db
    .select()
    .from(schema.mediaLinks)
    .where(and(eq(schema.mediaLinks.mediaId, id), isNull(schema.mediaLinks.deletedAt)));

  for (const link of links) {
    await db.update(schema.mediaLinks).set({ deletedAt: ts }).where(eq(schema.mediaLinks.id, link.id));
  }

  const activeLinks = await db
    .select()
    .from(schema.mediaLinks)
    .where(and(eq(schema.mediaLinks.mediaId, id), isNull(schema.mediaLinks.deletedAt)));

  if (activeLinks.length === 0) {
    const [asset] = await db.select().from(schema.mediaAssets).where(eq(schema.mediaAssets.id, id));
    if (asset) {
      await db.update(schema.mediaAssets).set({ deletedAt: ts, updatedAt: ts }).where(eq(schema.mediaAssets.id, id));
      const filePath = resolveProjectRelativePath(asset.relativePath);
      const thumbPath = asset.thumbRelativePath ? resolveProjectRelativePath(asset.thumbRelativePath) : null;
      if (filePath && existsSync(filePath)) {
        unlinkSync(filePath);
      }
      if (thumbPath && existsSync(thumbPath)) {
        unlinkSync(thumbPath);
      }
    }
  }
}

export async function setPrimaryPhoto(personId: string, mediaId: string): Promise<void> {
  const db = getDatabase();
  const ts = nowIso();
  await db.update(schema.people).set({ primaryPhotoId: mediaId, updatedAt: ts }).where(eq(schema.people.id, personId));
}

export async function openMedia(id: string): Promise<void> {
  const db = getDatabase();
  const [asset] = await db.select().from(schema.mediaAssets).where(eq(schema.mediaAssets.id, id));
  if (!asset) {
    return;
  }
  const filePath = resolveProjectRelativePath(asset.relativePath);
  if (filePath && existsSync(filePath)) {
    await shell.openPath(filePath);
  }
}

function resolveProjectRelativePath(relativePath: string): string | null {
  try {
    const project = requireProject();
    const root = resolve(project.path);
    const full = resolve(project.path, relativePath);
    if (!isPathInsideRoot(root, full)) {
      return null;
    }
    return full;
  } catch {
    return null;
  }
}

export function resolveMediaPath(relativePath: string): string | null {
  const full = resolveProjectRelativePath(relativePath);
  if (!full || !existsSync(full)) {
    return null;
  }
  return full;
}
