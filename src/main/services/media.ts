import { createHash } from 'crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync } from 'fs'
import { join, extname, basename } from 'path'
import { dialog, shell } from 'electron'
import { eq, and, isNull, inArray } from 'drizzle-orm'
import sharp from 'sharp'
import { getDatabase } from '../db/connection'
import * as schema from '../db/schema'
import { newId, nowIso } from '../utils/id'
import { getDeviceMeta } from './settings'
import { requireProject } from './project'
import type { MediaItem } from '@shared/types'

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

function hashFile(path: string): string {
  const data = readFileSync(path)
  return createHash('sha256').update(data).digest('hex')
}

function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.pdf': 'application/pdf'
  }
  return map[ext.toLowerCase()] ?? 'application/octet-stream'
}

export function mediaUrl(relativePath: string): string {
  const encoded = relativePath.split('/').map(encodeURIComponent).join('/')
  return `family-media://project/${encoded}`
}

export async function getThumbUrls(mediaIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const unique = [...new Set(mediaIds.filter(Boolean))]
  if (unique.length === 0) return map
  const db = getDatabase()
  const rows = await db.select().from(schema.mediaAssets).where(inArray(schema.mediaAssets.id, unique))
  for (const row of rows) {
    if (row.deletedAt) continue
    if (row.thumbRelativePath) map.set(row.id, mediaUrl(row.thumbRelativePath))
  }
  return map
}

async function mapMediaItem(row: typeof schema.mediaAssets.$inferSelect, personId?: string): Promise<MediaItem> {
  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    caption: row.caption,
    description: row.description,
    takenAt: row.takenAt,
    thumbUrl: row.thumbRelativePath ? mediaUrl(row.thumbRelativePath) : undefined,
    isPrimary: false
  }
}

export async function listMediaForPerson(personId: string): Promise<MediaItem[]> {
  const db = getDatabase()
  const [person] = await db.select().from(schema.people).where(eq(schema.people.id, personId))
  const links = await db
    .select()
    .from(schema.mediaLinks)
    .where(and(eq(schema.mediaLinks.personId, personId), isNull(schema.mediaLinks.deletedAt)))

  const items: MediaItem[] = []
  for (const link of links) {
    const [asset] = await db
      .select()
      .from(schema.mediaAssets)
      .where(and(eq(schema.mediaAssets.id, link.mediaId), isNull(schema.mediaAssets.deletedAt)))
    if (asset) {
      const item = await mapMediaItem(asset, personId)
      item.isPrimary = person?.primaryPhotoId === asset.id
      items.push(item)
    }
  }
  return items
}

export async function listMediaForEvent(eventId: string): Promise<MediaItem[]> {
  const db = getDatabase()
  const links = await db
    .select()
    .from(schema.mediaLinks)
    .where(and(eq(schema.mediaLinks.eventId, eventId), isNull(schema.mediaLinks.deletedAt)))

  const items: MediaItem[] = []
  for (const link of links) {
    const [asset] = await db
      .select()
      .from(schema.mediaAssets)
      .where(and(eq(schema.mediaAssets.id, link.mediaId), isNull(schema.mediaAssets.deletedAt)))
    if (asset) items.push(await mapMediaItem(asset))
  }
  return items
}

export async function addMedia(target: {
  personId?: string
  eventId?: string
}): Promise<MediaItem | null> {
  const result = await dialog.showOpenDialog({
    title: 'Добавить файл',
    properties: ['openFile'],
    filters: [
      { name: 'Media', extensions: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'pdf', 'doc', 'docx'] }
    ]
  })
  if (result.canceled || !result.filePaths[0]) return null

  const sourcePath = result.filePaths[0]
  const project = requireProject()
  const meta = getDeviceMeta()
  const ts = nowIso()
  const id = newId()
  const ext = extname(sourcePath) || '.bin'
  const relativePath = join('media', `${id}${ext}`)
  const destPath = join(project.path, relativePath)
  mkdirSync(join(project.path, 'media'), { recursive: true })
  copyFileSync(sourcePath, destPath)

  const contentHash = hashFile(destPath)
  const stat = readFileSync(destPath)
  const mimeType = mimeFromExt(ext)

  let thumbRelativePath: string | null = null
  if (IMAGE_TYPES.has(mimeType)) {
    try {
      thumbRelativePath = join('thumbs', `${id}.webp`)
      const thumbPath = join(project.path, thumbRelativePath)
      mkdirSync(join(project.path, 'thumbs'), { recursive: true })
      await sharp(destPath).resize(320, 320, { fit: 'inside' }).webp({ quality: 80 }).toFile(thumbPath)
    } catch {
      thumbRelativePath = null
    }
  }

  const db = getDatabase()
  await db.insert(schema.mediaAssets).values({
    id,
    relativePath,
    fileName: basename(sourcePath),
    mimeType,
    contentHash,
    fileSize: stat.length,
    thumbRelativePath,
    createdAt: ts,
    updatedAt: ts,
    createdByDeviceId: meta.deviceId,
    updatedByDeviceId: meta.deviceId,
    updatedByLabel: meta.label || null
  })

  await db.insert(schema.mediaLinks).values({
    id: newId(),
    mediaId: id,
    personId: target.personId ?? null,
    eventId: target.eventId ?? null,
    createdAt: ts
  })

  const [asset] = await db.select().from(schema.mediaAssets).where(eq(schema.mediaAssets.id, id))
  return mapMediaItem(asset!)
}

export async function deleteMedia(id: string): Promise<void> {
  const db = getDatabase()
  const project = requireProject()
  const ts = nowIso()

  const links = await db
    .select()
    .from(schema.mediaLinks)
    .where(and(eq(schema.mediaLinks.mediaId, id), isNull(schema.mediaLinks.deletedAt)))

  for (const link of links) {
    await db.update(schema.mediaLinks).set({ deletedAt: ts }).where(eq(schema.mediaLinks.id, link.id))
  }

  const activeLinks = await db
    .select()
    .from(schema.mediaLinks)
    .where(and(eq(schema.mediaLinks.mediaId, id), isNull(schema.mediaLinks.deletedAt)))

  if (activeLinks.length === 0) {
    const [asset] = await db.select().from(schema.mediaAssets).where(eq(schema.mediaAssets.id, id))
    if (asset) {
      await db.update(schema.mediaAssets).set({ deletedAt: ts, updatedAt: ts }).where(eq(schema.mediaAssets.id, id))
      const filePath = join(project.path, asset.relativePath)
      const thumbPath = asset.thumbRelativePath ? join(project.path, asset.thumbRelativePath) : null
      if (existsSync(filePath)) unlinkSync(filePath)
      if (thumbPath && existsSync(thumbPath)) unlinkSync(thumbPath)
    }
  }
}

export async function setPrimaryPhoto(personId: string, mediaId: string): Promise<void> {
  const db = getDatabase()
  const ts = nowIso()
  await db
    .update(schema.people)
    .set({ primaryPhotoId: mediaId, updatedAt: ts })
    .where(eq(schema.people.id, personId))
}

export async function openMedia(id: string): Promise<void> {
  const db = getDatabase()
  const project = requireProject()
  const [asset] = await db.select().from(schema.mediaAssets).where(eq(schema.mediaAssets.id, id))
  if (!asset) return
  const filePath = join(project.path, asset.relativePath)
  if (existsSync(filePath)) await shell.openPath(filePath)
}

export function resolveMediaPath(relativePath: string): string | null {
  try {
    const project = requireProject()
    const decoded = decodeURIComponent(relativePath)
    const full = join(project.path, decoded)
    if (!full.startsWith(project.path)) return null
    if (!existsSync(full)) return null
    return full
  } catch {
    return null
  }
}
