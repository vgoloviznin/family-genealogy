import { eq, and, isNull, inArray } from 'drizzle-orm';
import { getDatabase } from '../db/connection';
import * as schema from '../db/schema';
import { mapPerson } from './person-mapper';
import type { FamilySummary, PedigreeType } from '@shared/types';
import { normalizeUnionType } from '@shared/union-type';

export async function getFamiliesForPerson(personId: string): Promise<FamilySummary[]> {
  const db = getDatabase();

  const partnerRows = await db
    .select()
    .from(schema.familyPartners)
    .where(and(eq(schema.familyPartners.personId, personId), isNull(schema.familyPartners.deletedAt)));

  const childRows = await db
    .select()
    .from(schema.familyChildren)
    .where(and(eq(schema.familyChildren.personId, personId), isNull(schema.familyChildren.deletedAt)));

  const familyIds = [...new Set([...partnerRows.map((r) => r.familyId), ...childRows.map((r) => r.familyId)])];
  if (familyIds.length === 0) {
    return [];
  }

  const families = await db
    .select()
    .from(schema.families)
    .where(and(inArray(schema.families.id, familyIds), isNull(schema.families.deletedAt)));

  const summaries: FamilySummary[] = [];

  for (const family of families) {
    const partners = await db
      .select()
      .from(schema.familyPartners)
      .where(and(eq(schema.familyPartners.familyId, family.id), isNull(schema.familyPartners.deletedAt)));

    const children = await db
      .select()
      .from(schema.familyChildren)
      .where(and(eq(schema.familyChildren.familyId, family.id), isNull(schema.familyChildren.deletedAt)));

    const partnerPeople = [];
    for (const p of partners) {
      const [person] = await db
        .select()
        .from(schema.people)
        .where(and(eq(schema.people.id, p.personId), isNull(schema.people.deletedAt)));
      if (person) {
        partnerPeople.push(mapPerson(person));
      }
    }

    const childPeople = [];
    for (const c of children) {
      const [person] = await db
        .select()
        .from(schema.people)
        .where(and(eq(schema.people.id, c.personId), isNull(schema.people.deletedAt)));
      if (person) {
        childPeople.push({ person: mapPerson(person), pedigree: c.pedigree as PedigreeType });
      }
    }

    summaries.push({
      id: family.id,
      unionType: normalizeUnionType(family.unionType),
      partners: partnerPeople,
      children: childPeople
    });
  }

  return summaries;
}
