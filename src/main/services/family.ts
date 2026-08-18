import { eq, and, isNull, inArray } from 'drizzle-orm'
import { getDatabase } from '../db/connection'
import * as schema from '../db/schema'
import { newId, nowIso } from '../utils/id'
import { getDeviceMeta } from './settings'
import { createPerson, getPersonDetail, mapPerson } from './people'
import type {
  CreatePersonInput,
  FamilySummary,
  PedigreeType,
  PersonDetail,
  UnionType
} from '@shared/types'

export async function getFamiliesForPerson(personId: string): Promise<FamilySummary[]> {
  const db = getDatabase()

  const partnerRows = await db
    .select()
    .from(schema.familyPartners)
    .where(and(eq(schema.familyPartners.personId, personId), isNull(schema.familyPartners.deletedAt)))

  const childRows = await db
    .select()
    .from(schema.familyChildren)
    .where(and(eq(schema.familyChildren.personId, personId), isNull(schema.familyChildren.deletedAt)))

  const familyIds = [...new Set([...partnerRows.map((r) => r.familyId), ...childRows.map((r) => r.familyId)])]
  if (familyIds.length === 0) return []

  const families = await db
    .select()
    .from(schema.families)
    .where(and(inArray(schema.families.id, familyIds), isNull(schema.families.deletedAt)))

  const summaries: FamilySummary[] = []

  for (const family of families) {
    const partners = await db
      .select()
      .from(schema.familyPartners)
      .where(and(eq(schema.familyPartners.familyId, family.id), isNull(schema.familyPartners.deletedAt)))

    const children = await db
      .select()
      .from(schema.familyChildren)
      .where(and(eq(schema.familyChildren.familyId, family.id), isNull(schema.familyChildren.deletedAt)))

    const partnerPeople = []
    for (const p of partners) {
      const [person] = await db
        .select()
        .from(schema.people)
        .where(and(eq(schema.people.id, p.personId), isNull(schema.people.deletedAt)))
      if (person) partnerPeople.push(mapPerson(person))
    }

    const childPeople = []
    for (const c of children) {
      const [person] = await db
        .select()
        .from(schema.people)
        .where(and(eq(schema.people.id, c.personId), isNull(schema.people.deletedAt)))
      if (person) {
        childPeople.push({ person: mapPerson(person), pedigree: c.pedigree as PedigreeType })
      }
    }

    summaries.push({
      id: family.id,
      unionType: family.unionType as UnionType,
      partners: partnerPeople,
      children: childPeople
    })
  }

  return summaries
}

async function createFamily(unionType: UnionType = 'marriage'): Promise<string> {
  const db = getDatabase()
  const meta = getDeviceMeta()
  const ts = nowIso()
  const id = newId()
  await db.insert(schema.families).values({
    id,
    unionType,
    createdAt: ts,
    updatedAt: ts,
    createdByDeviceId: meta.deviceId,
    updatedByDeviceId: meta.deviceId,
    updatedByLabel: meta.label || null
  })
  return id
}

async function linkPartner(familyId: string, personId: string, sortOrder = 0): Promise<void> {
  const db = getDatabase()
  const ts = nowIso()
  await db.insert(schema.familyPartners).values({
    id: newId(),
    familyId,
    personId,
    sortOrder,
    createdAt: ts,
    updatedAt: ts
  })
}

async function linkChild(familyId: string, personId: string, pedigree: PedigreeType = 'birth'): Promise<void> {
  const db = getDatabase()
  const ts = nowIso()
  await db.insert(schema.familyChildren).values({
    id: newId(),
    familyId,
    personId,
    pedigree,
    createdAt: ts,
    updatedAt: ts
  })
}

export async function addPartner(
  personId: string,
  partnerInput: CreatePersonInput,
  unionType: UnionType = 'marriage'
): Promise<PersonDetail> {
  const partner = await createPerson(partnerInput)

  const existingFamilies = await getFamiliesForPerson(personId)
  const partnerFamily = existingFamilies.find(
    (f) => f.partners.length === 1 && f.partners[0]?.id === personId
  )

  let familyId: string
  if (partnerFamily) {
    familyId = partnerFamily.id
    await linkPartner(familyId, partner.id, 1)
  } else {
    familyId = await createFamily(unionType)
    await linkPartner(familyId, personId, 0)
    await linkPartner(familyId, partner.id, 1)
  }

  return (await getPersonDetail(partner.id))!
}

export async function addChildToFamily(
  familyId: string,
  childInput: CreatePersonInput,
  pedigree: PedigreeType = 'birth'
): Promise<PersonDetail> {
  const child = await createPerson(childInput)
  await linkChild(familyId, child.id, pedigree)
  const partners = await getDatabase()
    .select()
    .from(schema.familyPartners)
    .where(and(eq(schema.familyPartners.familyId, familyId), isNull(schema.familyPartners.deletedAt)))
  const parentId = partners[0]?.personId
  if (!parentId) throw new Error('Family has no parent')
  return (await getPersonDetail(child.id))!
}

export async function addParents(
  personId: string,
  parentInputs: [CreatePersonInput, CreatePersonInput?],
  pedigree: PedigreeType = 'birth'
): Promise<PersonDetail> {
  const familyId = await createFamily('partnership')
  const parent1 = await createPerson(parentInputs[0])
  await linkPartner(familyId, parent1.id, 0)

  if (parentInputs[1]) {
    const parent2 = await createPerson(parentInputs[1])
    await linkPartner(familyId, parent2.id, 1)
  }

  await linkChild(familyId, personId, pedigree)
  return (await getPersonDetail(parent1.id))!
}

export async function getOrCreateFamilyForNewChild(personId: string): Promise<string> {
  const families = await getFamiliesForPerson(personId)
  const asPartner = families.find((f) => f.partners.some((p) => p.id === personId))
  if (asPartner) return asPartner.id
  const familyId = await createFamily('marriage')
  await linkPartner(familyId, personId, 0)
  return familyId
}

export async function addChildToPerson(
  personId: string,
  childInput: CreatePersonInput,
  pedigree: PedigreeType = 'birth'
): Promise<PersonDetail> {
  const familyId = await getOrCreateFamilyForNewChild(personId)
  return addChildToFamily(familyId, childInput, pedigree)
}

export async function linkExistingPartner(
  personId: string,
  partnerId: string,
  unionType: UnionType = 'marriage'
): Promise<void> {
  if (personId === partnerId) throw new Error('Нельзя связать человека с самим собой')
  const families = await getFamiliesForPerson(personId)
  const already = families.some((f) => f.partners.some((p) => p.id === partnerId))
  if (already) throw new Error('Эти люди уже партнёры')

  const partnerFamily = families.find((f) => f.partners.length === 1 && f.partners[0]?.id === personId)
  let familyId: string
  if (partnerFamily) {
    familyId = partnerFamily.id
    await linkPartner(familyId, partnerId, 1)
  } else {
    familyId = await createFamily(unionType)
    await linkPartner(familyId, personId, 0)
    await linkPartner(familyId, partnerId, 1)
  }
}

export async function linkExistingChild(
  personId: string,
  childId: string,
  pedigree: PedigreeType = 'birth'
): Promise<void> {
  if (personId === childId) throw new Error('Нельзя сделать человека своим ребёнком')
  const familyId = await getOrCreateFamilyForNewChild(personId)
  await linkChildToFamily(familyId, childId, pedigree)
}

export async function linkExistingParent(
  personId: string,
  parentId: string,
  pedigree: PedigreeType = 'birth'
): Promise<void> {
  if (personId === parentId) throw new Error('Нельзя сделать человека своим родителем')
  const families = await getFamiliesForPerson(personId)
  const asChild = families.find((f) => f.children.some((c) => c.person.id === personId))
  if (asChild) {
    if (asChild.partners.some((p) => p.id === parentId)) throw new Error('Этот человек уже указан как родитель')
    await linkPartner(asChild.id, parentId, asChild.partners.length)
    return
  }
  const familyId = await createFamily('partnership')
  await linkPartner(familyId, parentId, 0)
  await linkChild(familyId, personId, pedigree)
}

export async function linkPartnerToFamily(familyId: string, personId: string): Promise<void> {
  const families = await getFamiliesForPerson(personId)
  if (families.some((f) => f.id === familyId && f.partners.some((p) => p.id === personId))) {
    throw new Error('Человек уже в этом союзе')
  }
  await linkPartner(familyId, personId, 1)
}

export async function linkChildToFamily(
  familyId: string,
  childId: string,
  pedigree: PedigreeType = 'birth'
): Promise<void> {
  const db = getDatabase()
  const [existing] = await db
    .select()
    .from(schema.familyChildren)
    .where(
      and(
        eq(schema.familyChildren.familyId, familyId),
        eq(schema.familyChildren.personId, childId),
        isNull(schema.familyChildren.deletedAt)
      )
    )
  if (existing) throw new Error('Этот человек уже указан как ребёнок в союзе')
  await linkChild(familyId, childId, pedigree)
}

export async function unlinkPartner(familyId: string, personId: string): Promise<void> {
  const db = getDatabase()
  const ts = nowIso()
  await db
    .update(schema.familyPartners)
    .set({ deletedAt: ts, updatedAt: ts })
    .where(
      and(
        eq(schema.familyPartners.familyId, familyId),
        eq(schema.familyPartners.personId, personId),
        isNull(schema.familyPartners.deletedAt)
      )
    )
}

export async function unlinkChild(familyId: string, personId: string): Promise<void> {
  const db = getDatabase()
  const ts = nowIso()
  await db
    .update(schema.familyChildren)
    .set({ deletedAt: ts, updatedAt: ts })
    .where(
      and(
        eq(schema.familyChildren.familyId, familyId),
        eq(schema.familyChildren.personId, personId),
        isNull(schema.familyChildren.deletedAt)
      )
    )
}

export async function relinkPartner(familyId: string, personId: string): Promise<void> {
  const db = getDatabase()
  const ts = nowIso()
  const rows = await db
    .select()
    .from(schema.familyPartners)
    .where(and(eq(schema.familyPartners.familyId, familyId), eq(schema.familyPartners.personId, personId)))
  const last = rows.at(-1)
  if (last) {
    await db.update(schema.familyPartners).set({ deletedAt: null, updatedAt: ts }).where(eq(schema.familyPartners.id, last.id))
    return
  }
  await linkPartner(familyId, personId, 0)
}

export async function relinkChild(
  familyId: string,
  personId: string,
  pedigree: PedigreeType = 'birth'
): Promise<void> {
  const db = getDatabase()
  const ts = nowIso()
  const rows = await db
    .select()
    .from(schema.familyChildren)
    .where(and(eq(schema.familyChildren.familyId, familyId), eq(schema.familyChildren.personId, personId)))
  const last = rows.at(-1)
  if (last) {
    await db
      .update(schema.familyChildren)
      .set({ deletedAt: null, updatedAt: ts, pedigree })
      .where(eq(schema.familyChildren.id, last.id))
    return
  }
  await linkChild(familyId, personId, pedigree)
}

export async function setUnionType(familyId: string, unionType: UnionType): Promise<void> {
  const db = getDatabase()
  const ts = nowIso()
  await db.update(schema.families).set({ unionType, updatedAt: ts }).where(eq(schema.families.id, familyId))
}

export async function setChildPedigree(familyId: string, childId: string, pedigree: PedigreeType): Promise<void> {
  const db = getDatabase()
  const ts = nowIso()
  await db
    .update(schema.familyChildren)
    .set({ pedigree, updatedAt: ts })
    .where(
      and(
        eq(schema.familyChildren.familyId, familyId),
        eq(schema.familyChildren.personId, childId),
        isNull(schema.familyChildren.deletedAt)
      )
    )
}
