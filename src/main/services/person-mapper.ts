import { eq, and, isNull, or, inArray } from 'drizzle-orm';
import { getDatabase } from '../db/connection';
import * as schema from '../db/schema';
import { getThumbUrls } from './media';
import type { Person, LifeEvent, PartialDate, Sex } from '@shared/types';

type PersonRow = typeof schema.people.$inferSelect;
type EventRow = typeof schema.events.$inferSelect;

export function mapPerson(row: PersonRow, life?: { birthYear?: number | null; deathYear?: number | null }): Person {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    middleName: row.middleName,
    maidenName: row.maidenName,
    firstNameEn: row.firstNameEn ?? '',
    lastNameEn: row.lastNameEn ?? '',
    middleNameEn: row.middleNameEn,
    maidenNameEn: row.maidenNameEn,
    sex: row.sex as Sex,
    isLiving: row.isLiving,
    notes: row.notes,
    primaryPhotoId: row.primaryPhotoId,
    thumbUrl: null,
    birthYear: life?.birthYear ?? null,
    deathYear: life?.deathYear ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt
  };
}

export async function loadLifeYears(personIds: string[]): Promise<Map<string, { birthYear?: number | null; deathYear?: number | null }>> {
  const map = new Map<string, { birthYear?: number | null; deathYear?: number | null }>();
  if (personIds.length === 0) {
    return map;
  }

  const db = getDatabase();
  const rows = await db
    .select()
    .from(schema.events)
    .where(
      and(
        inArray(schema.events.personId, personIds),
        isNull(schema.events.deletedAt),
        or(eq(schema.events.type, 'birth'), eq(schema.events.type, 'death'))
      )
    );

  for (const id of personIds) {
    map.set(id, {});
  }
  for (const ev of rows) {
    if (!ev.personId) {
      continue;
    }
    const entry = map.get(ev.personId) ?? {};
    if (ev.type === 'birth') {
      entry.birthYear = ev.dateYear;
    }
    if (ev.type === 'death') {
      entry.deathYear = ev.dateYear;
    }
    map.set(ev.personId, entry);
  }
  return map;
}

export function mapEvent(row: EventRow, placeName?: string | null): LifeEvent {
  return {
    id: row.id,
    type: row.type as LifeEvent['type'],
    customLabel: row.customLabel,
    personId: row.personId,
    familyId: row.familyId,
    placeId: row.placeId,
    placeName: placeName ?? null,
    description: row.description,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    date: {
      year: row.dateYear,
      month: row.dateMonth,
      day: row.dateDay,
      hour: row.dateHour,
      minute: row.dateMinute,
      precision: row.datePrecision as PartialDate['precision'],
      originalText: row.dateOriginalText,
      sortKey: row.dateSortKey
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export async function loadPlaceNames(placeIds: (string | null | undefined)[]): Promise<Map<string, string>> {
  const ids = [...new Set(placeIds.filter((id): id is string => Boolean(id)))];
  const map = new Map<string, string>();
  if (ids.length === 0) {
    return map;
  }
  const db = getDatabase();
  const rows = await db
    .select()
    .from(schema.places)
    .where(and(inArray(schema.places.id, ids), isNull(schema.places.deletedAt)));
  for (const row of rows) {
    map.set(row.id, row.name);
  }
  return map;
}

export async function mapEvents(rows: EventRow[]): Promise<LifeEvent[]> {
  const placeMap = await loadPlaceNames(rows.map((r) => r.placeId));
  return rows.map((r) => mapEvent(r, r.placeId ? (placeMap.get(r.placeId) ?? null) : null));
}

export async function getPlaceName(placeId: string | null): Promise<string | null> {
  if (!placeId) {
    return null;
  }
  const db = getDatabase();
  const [place] = await db
    .select()
    .from(schema.places)
    .where(and(eq(schema.places.id, placeId), isNull(schema.places.deletedAt)));
  return place?.name ?? null;
}

export async function attachThumbs(people: Person[]): Promise<Person[]> {
  const ids = people.map((p) => p.primaryPhotoId).filter((id): id is string => Boolean(id));
  const thumbs = await getThumbUrls(ids);
  return people.map((p) => ({
    ...p,
    thumbUrl: p.primaryPhotoId ? (thumbs.get(p.primaryPhotoId) ?? null) : null
  }));
}
