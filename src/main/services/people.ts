import { eq, and, isNull, like, or, sql } from 'drizzle-orm';
import { getDatabase } from '../db/connection';
import * as schema from '../db/schema';
import { newId, nowIso } from '../utils/id';
import { normalizePartialDate, defaultDate } from '../utils/dates';
import { getDeviceMeta } from './settings';
import { attachThumbs, loadLifeYears, mapEvent, mapPerson, getPlaceName } from './person-mapper';
import { getPersonDetail } from './person-detail';
import type { Person, LifeEvent, PartialDate, CreatePersonInput, UpdatePersonInput, PersonDetail } from '@shared/types';

export { getPersonDetail } from './person-detail';
export { mapPerson, loadLifeYears } from './person-mapper';

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
      placeName: input.birth.placeName ?? undefined,
      description: input.birth.description ?? undefined,
      date: input.birth.date ?? defaultDate()
    });
  }

  if (input.death) {
    await upsertEventRecord({
      type: 'death',
      personId: id,
      placeName: input.death.placeName ?? undefined,
      description: input.death.description ?? undefined,
      date: input.death.date ?? defaultDate()
    });
  }

  if (input.burial) {
    await upsertEventRecord({
      type: 'burial',
      personId: id,
      placeName: input.burial.placeName ?? undefined,
      description: input.burial.description ?? undefined,
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
      placeName: input.birth?.placeName ?? undefined,
      description: input.birth?.description ?? undefined,
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
      placeName: input.death?.placeName ?? undefined,
      description: input.death?.description ?? undefined,
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
      placeName: input.burial?.placeName ?? undefined,
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
