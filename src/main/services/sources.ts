import { eq, and, isNull } from 'drizzle-orm'
import { getDatabase } from '../db/connection'
import * as schema from '../db/schema'
import { newId, nowIso } from '../utils/id'
import { getDeviceMeta } from './settings'
import type { CitationView, CreateCitationInput, CreateSourceInput, Source, SourceType } from '@shared/types'

function mapSource(row: typeof schema.sources.$inferSelect): Source {
  return {
    id: row.id,
    title: row.title,
    type: row.type as SourceType,
    author: row.author,
    details: row.details,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

export async function listSources(): Promise<Source[]> {
  const db = getDatabase()
  const rows = await db
    .select()
    .from(schema.sources)
    .where(isNull(schema.sources.deletedAt))
    .orderBy(schema.sources.title)
  return rows.map(mapSource)
}

export async function createSource(input: CreateSourceInput): Promise<Source> {
  const db = getDatabase()
  const meta = getDeviceMeta()
  const ts = nowIso()
  const id = newId()
  await db.insert(schema.sources).values({
    id,
    title: input.title.trim(),
    type: input.type ?? 'other',
    author: input.author?.trim() || null,
    details: input.details?.trim() || null,
    notes: input.notes?.trim() || null,
    createdAt: ts,
    updatedAt: ts,
    createdByDeviceId: meta.deviceId,
    updatedByDeviceId: meta.deviceId,
    updatedByLabel: meta.label || null
  })
  const [row] = await db.select().from(schema.sources).where(eq(schema.sources.id, id))
  return mapSource(row!)
}

export async function updateSource(input: Partial<CreateSourceInput> & { id: string }): Promise<Source> {
  const db = getDatabase()
  const meta = getDeviceMeta()
  const ts = nowIso()
  await db
    .update(schema.sources)
    .set({
      title: input.title?.trim(),
      type: input.type,
      author: input.author?.trim() || null,
      details: input.details?.trim() || null,
      notes: input.notes?.trim() || null,
      updatedAt: ts,
      updatedByDeviceId: meta.deviceId,
      updatedByLabel: meta.label || null
    })
    .where(eq(schema.sources.id, input.id))
  const [row] = await db.select().from(schema.sources).where(eq(schema.sources.id, input.id))
  if (!row) throw new Error('Источник не найден')
  return mapSource(row)
}

export async function deleteSource(id: string): Promise<void> {
  const db = getDatabase()
  const ts = nowIso()
  await db.update(schema.sources).set({ deletedAt: ts, updatedAt: ts }).where(eq(schema.sources.id, id))
  await db
    .update(schema.citations)
    .set({ deletedAt: ts, updatedAt: ts })
    .where(and(eq(schema.citations.sourceId, id), isNull(schema.citations.deletedAt)))
}

export async function listCitationsForPerson(personId: string): Promise<CitationView[]> {
  const db = getDatabase()
  const rows = await db
    .select()
    .from(schema.citations)
    .where(and(eq(schema.citations.personId, personId), isNull(schema.citations.deletedAt)))

  const result: CitationView[] = []
  for (const row of rows) {
    const [source] = await db
      .select()
      .from(schema.sources)
      .where(and(eq(schema.sources.id, row.sourceId), isNull(schema.sources.deletedAt)))
    if (!source) continue
    result.push({
      id: row.id,
      sourceId: row.sourceId,
      source: mapSource(source),
      personId: row.personId,
      eventId: row.eventId,
      page: row.page,
      excerpt: row.excerpt,
      notes: row.notes
    })
  }
  return result
}

export async function createCitation(input: CreateCitationInput): Promise<CitationView> {
  let sourceId = input.sourceId
  if (!sourceId && input.newSource) {
    const source = await createSource(input.newSource)
    sourceId = source.id
  }
  if (!sourceId) throw new Error('Укажите источник')
  if (!input.personId && !input.eventId) throw new Error('Цитата должна относиться к человеку или событию')

  const db = getDatabase()
  const meta = getDeviceMeta()
  const ts = nowIso()
  const id = newId()
  await db.insert(schema.citations).values({
    id,
    sourceId,
    personId: input.personId ?? null,
    eventId: input.eventId ?? null,
    page: input.page?.trim() || null,
    excerpt: input.excerpt?.trim() || null,
    notes: input.notes?.trim() || null,
    createdAt: ts,
    updatedAt: ts,
    createdByDeviceId: meta.deviceId,
    updatedByDeviceId: meta.deviceId,
    updatedByLabel: meta.label || null
  })

  const list = input.personId ? await listCitationsForPerson(input.personId) : []
  const created = list.find((c) => c.id === id)
  if (created) return created

  const [source] = await db.select().from(schema.sources).where(eq(schema.sources.id, sourceId))
  return {
    id,
    sourceId,
    source: mapSource(source!),
    personId: input.personId ?? null,
    eventId: input.eventId ?? null,
    page: input.page ?? null,
    excerpt: input.excerpt ?? null,
    notes: input.notes ?? null
  }
}

export async function deleteCitation(id: string): Promise<void> {
  const db = getDatabase()
  const ts = nowIso()
  await db.update(schema.citations).set({ deletedAt: ts, updatedAt: ts }).where(eq(schema.citations.id, id))
}

export async function restoreCitation(id: string): Promise<void> {
  const db = getDatabase()
  const ts = nowIso()
  await db.update(schema.citations).set({ deletedAt: null, updatedAt: ts }).where(eq(schema.citations.id, id))
}
