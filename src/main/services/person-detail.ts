import { eq, and, isNull, inArray } from 'drizzle-orm';
import { getDatabase } from '../db/connection';
import * as schema from '../db/schema';
import { attachThumbs, loadLifeYears, mapPerson, mapEvents } from './person-mapper';
import { getFamiliesForPerson } from './family-query';
import { listAssociationsForPerson } from './associations';
import { listMediaForPerson } from './media';
import { listCitationsForPerson } from './sources';
import type { PersonDetail, LifeEvent } from '@shared/types';

export async function getPersonDetail(id: string): Promise<PersonDetail | null> {
  const db = getDatabase();
  const [row] = await db
    .select()
    .from(schema.people)
    .where(and(eq(schema.people.id, id), isNull(schema.people.deletedAt)));
  if (!row) {
    return null;
  }

  const partnerFamilyIds = await getFamiliesForPerson(id);
  const familyIds = partnerFamilyIds.map((f) => f.id);

  const [personEventRows, familyEventRows, lifeYearsMap] = await Promise.all([
    db
      .select()
      .from(schema.events)
      .where(and(eq(schema.events.personId, id), isNull(schema.events.deletedAt))),
    familyIds.length > 0
      ? db
          .select()
          .from(schema.events)
          .where(and(inArray(schema.events.familyId, familyIds), isNull(schema.events.deletedAt)))
      : Promise.resolve([]),
    loadLifeYears([id])
  ]);

  const mappedPersonEvents = await mapEvents(personEventRows);
  const birthEvent = mappedPersonEvents.find((e) => e.type === 'birth') ?? null;
  const deathEvent = mappedPersonEvents.find((e) => e.type === 'death') ?? null;
  const burialEvent = mappedPersonEvents.find((e) => e.type === 'burial') ?? null;
  const otherEvents: LifeEvent[] = mappedPersonEvents.filter((e) => e.type !== 'birth' && e.type !== 'death' && e.type !== 'burial');

  const mappedFamilyEvents = await mapEvents(familyEventRows);
  const seen = new Set(otherEvents.map((e) => e.id));
  for (const event of mappedFamilyEvents) {
    if (!seen.has(event.id)) {
      otherEvents.push(event);
      seen.add(event.id);
    }
  }

  otherEvents.sort((a, b) => (b.date.sortKey ?? 0) - (a.date.sortKey ?? 0));

  const [person] = await attachThumbs([mapPerson(row, lifeYearsMap.get(id))]);
  const [associations, media, citations] = await Promise.all([listAssociationsForPerson(id), listMediaForPerson(id), listCitationsForPerson(id)]);

  return {
    ...person,
    birthEvent,
    deathEvent,
    burialEvent,
    events: otherEvents,
    families: partnerFamilyIds,
    associations,
    media,
    citations
  };
}
