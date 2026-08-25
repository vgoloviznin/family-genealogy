import { eq, and, isNull, like, or, sql, inArray } from 'drizzle-orm';
import { getDatabase } from '../db/connection';
import * as schema from '../db/schema';
import { newId, nowIso } from '../utils/id';
import { normalizePartialDate, defaultDate } from '../utils/dates';
import { getDeviceMeta } from './settings';
import type { Person, PersonDetail, LifeEvent, PartialDate, CreatePersonInput, UpdatePersonInput, Sex } from '@shared/types';
import { getFamiliesForPerson } from './family';
import { listAssociationsForPerson } from './associations';
import { listMediaForPerson, getThumbUrls } from './media';
import { listCitationsForPerson } from './sources';

type PersonRow = typeof schema.people.$inferSelect;
type EventRow = typeof schema.events.$inferSelect;

function mapPerson(row: PersonRow, life?: { birthYear?: number | null; deathYear?: number | null }): Person {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    middleName: row.middleName,
    maidenName: row.maidenName,
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

async function loadLifeYears(personIds: string[]): Promise<Map<string, { birthYear?: number | null; deathYear?: number | null }>> {
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

function mapEvent(row: EventRow, placeName?: string | null): LifeEvent {
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

async function getPlaceName(placeId: string | null): Promise<string | null> {
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

export async function upsertPlaceByName(name: string | undefined): Promise<string | null> {
  if (!name?.trim()) {
    return null;
  }
  const db = getDatabase();
  const normalized = name.trim().toLowerCase();
  const [existing] = await db
    .select()
    .from(schema.places)
    .where(and(eq(schema.places.normalizedName, normalized), isNull(schema.places.deletedAt)));
  if (existing) {
    return existing.id;
  }

  const id = newId();
  const ts = nowIso();
  await db.insert(schema.places).values({
    id,
    name: name.trim(),
    normalizedName: normalized,
    createdAt: ts,
    updatedAt: ts
  });
  return id;
}

export async function upsertEventRecord(input: {
  id?: string;
  type: LifeEvent['type'];
  customLabel?: string;
  personId?: string;
  familyId?: string;
  placeName?: string;
  description?: string;
  latitude?: number | null;
  longitude?: number | null;
  date?: PartialDate;
}): Promise<LifeEvent> {
  const db = getDatabase();
  const meta = getDeviceMeta();
  const ts = nowIso();
  const date = normalizePartialDate(input.date ?? defaultDate());
  const placeId = await upsertPlaceByName(input.placeName);
  const id = input.id ?? newId();

  const values = {
    type: input.type,
    customLabel: input.customLabel ?? null,
    personId: input.personId ?? null,
    familyId: input.familyId ?? null,
    placeId,
    description: input.description ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    dateYear: date.year ?? null,
    dateMonth: date.month ?? null,
    dateDay: date.day ?? null,
    dateHour: date.hour ?? null,
    dateMinute: date.minute ?? null,
    datePrecision: date.precision,
    dateOriginalText: date.originalText ?? null,
    dateSortKey: date.sortKey ?? null,
    updatedAt: ts,
    updatedByDeviceId: meta.deviceId,
    updatedByLabel: meta.label || null
  };

  const [existing] = await db.select().from(schema.events).where(eq(schema.events.id, id));
  if (existing) {
    await db.update(schema.events).set(values).where(eq(schema.events.id, id));
  } else {
    await db.insert(schema.events).values({
      id,
      ...values,
      createdAt: ts,
      createdByDeviceId: meta.deviceId
    });
  }

  const placeName = await getPlaceName(placeId);
  const [row] = await db.select().from(schema.events).where(eq(schema.events.id, id));
  return mapEvent(row!, placeName);
}

export async function listPeople(): Promise<Person[]> {
  const db = getDatabase();
  const rows = await db.select().from(schema.people).where(isNull(schema.people.deletedAt)).orderBy(schema.people.lastName, schema.people.firstName);
  const life = await loadLifeYears(rows.map((r) => r.id));
  return attachThumbs(rows.map((r) => mapPerson(r, life.get(r.id))));
}

export async function attachThumbs(people: Person[]): Promise<Person[]> {
  const ids = people.map((p) => p.primaryPhotoId).filter((id): id is string => Boolean(id));
  const thumbs = await getThumbUrls(ids);
  return people.map((p) => ({
    ...p,
    thumbUrl: p.primaryPhotoId ? (thumbs.get(p.primaryPhotoId) ?? null) : null
  }));
}

export async function searchPeople(query: string): Promise<Person[]> {
  const q = `%${query.trim().toLowerCase()}%`;
  const db = getDatabase();
  const rows = await db
    .select()
    .from(schema.people)
    .where(
      and(
        isNull(schema.people.deletedAt),
        or(
          like(sql`lower(${schema.people.firstName})`, q),
          like(sql`lower(${schema.people.lastName})`, q),
          like(sql`lower(${schema.people.middleName})`, q),
          like(sql`lower(${schema.people.maidenName})`, q)
        )
      )
    );
  const life = await loadLifeYears(rows.map((r) => r.id));
  return attachThumbs(rows.map((r) => mapPerson(r, life.get(r.id))));
}

export async function getPersonDetail(id: string): Promise<PersonDetail | null> {
  const db = getDatabase();
  const [row] = await db
    .select()
    .from(schema.people)
    .where(and(eq(schema.people.id, id), isNull(schema.people.deletedAt)));
  if (!row) {
    return null;
  }

  const events = await db
    .select()
    .from(schema.events)
    .where(and(eq(schema.events.personId, id), isNull(schema.events.deletedAt)));

  const mappedEvents: LifeEvent[] = [];
  for (const e of events) {
    mappedEvents.push(mapEvent(e, await getPlaceName(e.placeId)));
  }

  const birthEvent = mappedEvents.find((e) => e.type === 'birth') ?? null;
  const deathEvent = mappedEvents.find((e) => e.type === 'death') ?? null;
  const burialEvent = mappedEvents.find((e) => e.type === 'burial') ?? null;
  const otherEvents = mappedEvents.filter((e) => e.type !== 'birth' && e.type !== 'death' && e.type !== 'burial');

  const familyEvents = await db.select().from(schema.events).where(isNull(schema.events.deletedAt));

  const partnerFamilyIds = await getFamiliesForPerson(id);
  const familyIds = new Set(partnerFamilyIds.map((f) => f.id));
  for (const fe of familyEvents) {
    if (fe.familyId && familyIds.has(fe.familyId)) {
      otherEvents.push(mapEvent(fe, await getPlaceName(fe.placeId)));
    }
  }

  otherEvents.sort((a, b) => (b.date.sortKey ?? 0) - (a.date.sortKey ?? 0));

  const [person] = await attachThumbs([mapPerson(row, (await loadLifeYears([id])).get(id))]);
  return {
    ...person,
    birthEvent,
    deathEvent,
    burialEvent,
    events: otherEvents,
    families: partnerFamilyIds,
    associations: await listAssociationsForPerson(id),
    media: await listMediaForPerson(id),
    citations: await listCitationsForPerson(id)
  };
}

export async function createPerson(input: CreatePersonInput): Promise<PersonDetail> {
  const db = getDatabase();
  const meta = getDeviceMeta();
  const ts = nowIso();
  const id = newId();

  await db.insert(schema.people).values({
    id,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    middleName: input.middleName?.trim() || null,
    maidenName: input.maidenName?.trim() || null,
    sex: input.sex ?? 'unknown',
    isLiving: input.isLiving ?? true,
    notes: input.notes?.trim() || null,
    createdAt: ts,
    updatedAt: ts,
    createdByDeviceId: meta.deviceId,
    updatedByDeviceId: meta.deviceId,
    updatedByLabel: meta.label || null
  });

  if (input.birth) {
    await upsertEventRecord({
      type: 'birth',
      personId: id,
      placeName: input.birth.placeName,
      description: input.birth.description,
      date: input.birth.date ?? defaultDate()
    });
  }

  if (input.death) {
    await upsertEventRecord({
      type: 'death',
      personId: id,
      placeName: input.death.placeName,
      description: input.death.description,
      date: input.death.date ?? defaultDate()
    });
  }

  if (input.burial) {
    await upsertEventRecord({
      type: 'burial',
      personId: id,
      placeName: input.burial.placeName,
      description: input.burial.description,
      latitude: input.burial.latitude,
      longitude: input.burial.longitude,
      date: input.burial.date ?? defaultDate()
    });
  }

  return (await getPersonDetail(id))!;
}

export async function updatePerson(input: UpdatePersonInput): Promise<PersonDetail> {
  const db = getDatabase();
  const meta = getDeviceMeta();
  const ts = nowIso();

  await db
    .update(schema.people)
    .set({
      firstName: input.firstName?.trim(),
      lastName: input.lastName?.trim(),
      middleName: input.middleName?.trim() || null,
      maidenName: input.maidenName?.trim() || null,
      sex: input.sex,
      isLiving: input.isLiving,
      notes: input.notes?.trim() || null,
      updatedAt: ts,
      updatedByDeviceId: meta.deviceId,
      updatedByLabel: meta.label || null
    })
    .where(eq(schema.people.id, input.id));

  const detail = await getPersonDetail(input.id);
  if (!detail) {
    throw new Error('Person not found');
  }

  if (input.birth !== undefined) {
    const birthId = detail.birthEvent?.id;
    await upsertEventRecord({
      id: birthId,
      type: 'birth',
      personId: input.id,
      placeName: input.birth?.placeName,
      description: input.birth?.description,
      date: input.birth?.date ?? defaultDate()
    });
  }

  if (input.death === null) {
    if (detail.deathEvent?.id) {
      await deleteEvent(detail.deathEvent.id);
    }
  } else if (input.death !== undefined) {
    const deathId = detail.deathEvent?.id;
    await upsertEventRecord({
      id: deathId,
      type: 'death',
      personId: input.id,
      placeName: input.death?.placeName,
      description: input.death?.description,
      date: input.death?.date ?? defaultDate()
    });
  }

  if (input.burial === null) {
    if (detail.burialEvent?.id) {
      await deleteEvent(detail.burialEvent.id);
    }
  } else if (input.burial !== undefined) {
    const burialId = detail.burialEvent?.id;
    await upsertEventRecord({
      id: burialId,
      type: 'burial',
      personId: input.id,
      placeName: input.burial?.placeName,
      description: input.burial?.description ?? detail.burialEvent?.description ?? undefined,
      latitude: input.burial?.latitude ?? null,
      longitude: input.burial?.longitude ?? null,
      date: input.burial?.date ?? detail.burialEvent?.date ?? defaultDate()
    });
  }

  return (await getPersonDetail(input.id))!;
}

export async function deletePerson(id: string): Promise<void> {
  const db = getDatabase();
  const ts = nowIso();
  await db.update(schema.people).set({ deletedAt: ts, updatedAt: ts }).where(eq(schema.people.id, id));
}

export async function restorePerson(id: string): Promise<void> {
  const db = getDatabase();
  const ts = nowIso();
  await db.update(schema.people).set({ deletedAt: null, updatedAt: ts }).where(eq(schema.people.id, id));
}

export async function listEventsForPerson(personId: string): Promise<LifeEvent[]> {
  const detail = await getPersonDetail(personId);
  if (!detail) {
    return [];
  }
  const all = [
    ...(detail.birthEvent ? [detail.birthEvent] : []),
    ...(detail.deathEvent ? [detail.deathEvent] : []),
    ...(detail.burialEvent ? [detail.burialEvent] : []),
    ...detail.events
  ];
  return all.sort((a, b) => (b.date.sortKey ?? 0) - (a.date.sortKey ?? 0));
}

export async function deleteEvent(id: string): Promise<void> {
  const db = getDatabase();
  const ts = nowIso();
  await db.update(schema.events).set({ deletedAt: ts, updatedAt: ts }).where(eq(schema.events.id, id));
}

export async function restoreEvent(input: {
  id: string;
  type: LifeEvent['type'];
  customLabel?: string;
  personId?: string;
  familyId?: string;
  placeName?: string;
  description?: string;
  latitude?: number | null;
  longitude?: number | null;
  date?: PartialDate;
}): Promise<LifeEvent> {
  const db = getDatabase();
  const ts = nowIso();
  const [existing] = await db.select().from(schema.events).where(eq(schema.events.id, input.id));
  if (existing) {
    await db.update(schema.events).set({ deletedAt: null, updatedAt: ts }).where(eq(schema.events.id, input.id));
  }
  return upsertEventRecord(input);
}

export async function searchPlaces(query: string): Promise<Array<{ id: string; name: string }>> {
  const db = getDatabase();
  const trimmed = query.trim().toLowerCase();
  const rows = await db
    .select({ id: schema.places.id, name: schema.places.name })
    .from(schema.places)
    .where(trimmed ? and(isNull(schema.places.deletedAt), like(schema.places.normalizedName, `%${trimmed}%`)) : isNull(schema.places.deletedAt))
    .limit(20);
  return rows;
}

export { mapPerson, loadLifeYears };
