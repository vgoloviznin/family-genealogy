import { eq, and, isNull, or } from 'drizzle-orm'
import { getDatabase } from '../db/connection'
import * as schema from '../db/schema'
import { newId, nowIso } from '../utils/id'
import { getDeviceMeta } from './settings'
import { mapPerson } from './people'
import type { AssociationView, CreateAssociationInput } from '@shared/types'

export async function listAssociationsForPerson(personId: string): Promise<AssociationView[]> {
  const db = getDatabase()
  const rows = await db
    .select()
    .from(schema.associations)
    .where(
      and(
        isNull(schema.associations.deletedAt),
        or(eq(schema.associations.fromPersonId, personId), eq(schema.associations.toPersonId, personId))
      )
    )

  const result: AssociationView[] = []
  for (const row of rows) {
    const otherId = row.fromPersonId === personId ? row.toPersonId : row.fromPersonId
    const [other] = await db
      .select()
      .from(schema.people)
      .where(and(eq(schema.people.id, otherId), isNull(schema.people.deletedAt)))
    if (!other) continue

    result.push({
      id: row.id,
      role: row.role as AssociationView['role'],
      customRole: row.customRole,
      fromPersonId: row.fromPersonId,
      toPersonId: row.toPersonId,
      toPerson: mapPerson(other),
      eventId: row.eventId,
      notes: row.notes
    })
  }
  return result
}

export async function createAssociation(input: CreateAssociationInput): Promise<AssociationView> {
  const db = getDatabase()
  const meta = getDeviceMeta()
  const ts = nowIso()
  const id = newId()

  await db.insert(schema.associations).values({
    id,
    fromPersonId: input.fromPersonId,
    toPersonId: input.toPersonId,
    role: input.role,
    customRole: input.customRole ?? null,
    eventId: input.eventId ?? null,
    notes: input.notes ?? null,
    createdAt: ts,
    updatedAt: ts,
    createdByDeviceId: meta.deviceId,
    updatedByDeviceId: meta.deviceId,
    updatedByLabel: meta.label || null
  })

  const list = await listAssociationsForPerson(input.fromPersonId)
  const created = list.find((a) => a.id === id)
  if (!created) throw new Error('Failed to create association')
  return created
}

export async function deleteAssociation(id: string): Promise<void> {
  const db = getDatabase()
  const ts = nowIso()
  await db.update(schema.associations).set({ deletedAt: ts, updatedAt: ts }).where(eq(schema.associations.id, id))
}
