import { eq, and, isNull } from 'drizzle-orm'
import { getDatabase } from '../db/connection'
import * as schema from '../db/schema'
import { mapPerson, attachThumbs } from './people'
import type { TreeData, TreeEdge, TreeNode, Person } from '@shared/types'

async function getPersonById(id: string): Promise<Person | null> {
  const db = getDatabase()
  const [row] = await db
    .select()
    .from(schema.people)
    .where(and(eq(schema.people.id, id), isNull(schema.people.deletedAt)))
  return row ? mapPerson(row) : null
}

async function getParentIds(personId: string): Promise<string[]> {
  const db = getDatabase()
  const childLinks = await db
    .select()
    .from(schema.familyChildren)
    .where(and(eq(schema.familyChildren.personId, personId), isNull(schema.familyChildren.deletedAt)))

  const parentIds: string[] = []
  for (const link of childLinks) {
    const partners = await db
      .select()
      .from(schema.familyPartners)
      .where(and(eq(schema.familyPartners.familyId, link.familyId), isNull(schema.familyPartners.deletedAt)))
    for (const p of partners) parentIds.push(p.personId)
  }
  return [...new Set(parentIds)]
}

async function getChildIds(personId: string): Promise<string[]> {
  const db = getDatabase()
  const partnerLinks = await db
    .select()
    .from(schema.familyPartners)
    .where(and(eq(schema.familyPartners.personId, personId), isNull(schema.familyPartners.deletedAt)))

  const childIds: string[] = []
  for (const link of partnerLinks) {
    const children = await db
      .select()
      .from(schema.familyChildren)
      .where(and(eq(schema.familyChildren.familyId, link.familyId), isNull(schema.familyChildren.deletedAt)))
    for (const c of children) childIds.push(c.personId)
  }
  return [...new Set(childIds)]
}

async function getPartnerIds(personId: string): Promise<string[]> {
  const db = getDatabase()
  const partnerLinks = await db
    .select()
    .from(schema.familyPartners)
    .where(and(eq(schema.familyPartners.personId, personId), isNull(schema.familyPartners.deletedAt)))

  const partnerIds: string[] = []
  for (const link of partnerLinks) {
    const partners = await db
      .select()
      .from(schema.familyPartners)
      .where(and(eq(schema.familyPartners.familyId, link.familyId), isNull(schema.familyPartners.deletedAt)))
    for (const p of partners) {
      if (p.personId !== personId) partnerIds.push(p.personId)
    }
  }
  return [...new Set(partnerIds)]
}

export async function getTree(personId: string, generations = 4): Promise<TreeData> {
  const focus = await getPersonById(personId)
  if (!focus) throw new Error('Person not found')

  const nodes = new Map<string, TreeNode>()
  const edges: TreeEdge[] = []
  const edgeSet = new Set<string>()

  const addNode = (person: Person, type: TreeNode['type'], generation: number): void => {
    if (!nodes.has(person.id)) {
      nodes.set(person.id, { id: person.id, person, type, generation })
    }
  }

  addNode(focus, 'focus', 0)

  async function walkAncestors(id: string, gen: number): Promise<void> {
    if (gen >= generations) return
    const parents = await getParentIds(id)
    for (const pid of parents) {
      const person = await getPersonById(pid)
      if (!person) continue
      addNode(person, 'ancestor', -gen - 1)
      const edgeId = `${pid}->${id}`
      if (!edgeSet.has(edgeId)) {
        edges.push({ id: edgeId, source: pid, target: id, kind: 'parent' })
        edgeSet.add(edgeId)
      }
      await walkAncestors(pid, gen + 1)
    }
  }

  async function walkDescendants(id: string, gen: number): Promise<void> {
    if (gen >= generations) return
    const children = await getChildIds(id)
    for (const cid of children) {
      const person = await getPersonById(cid)
      if (!person) continue
      addNode(person, 'descendant', gen + 1)
      const edgeId = `${id}->${cid}`
      if (!edgeSet.has(edgeId)) {
        edges.push({ id: edgeId, source: id, target: cid, kind: 'parent' })
        edgeSet.add(edgeId)
      }
      await walkDescendants(cid, gen + 1)
    }
  }

  await walkAncestors(personId, 0)
  await walkDescendants(personId, 0)

  const partners = await getPartnerIds(personId)
  for (const pid of partners) {
    const person = await getPersonById(pid)
    if (!person) continue
    addNode(person, 'focus', 0)
    const edgeId = [personId, pid].sort().join('<->')
    if (!edgeSet.has(edgeId)) {
      edges.push({ id: edgeId, source: personId, target: pid, kind: 'partner' })
      edgeSet.add(edgeId)
    }
  }

  const thumbs = await attachThumbs(Array.from(nodes.values()).map((n) => n.person))
  const thumbById = new Map(thumbs.map((p) => [p.id, p.thumbUrl]))
  for (const node of nodes.values()) {
    node.person = { ...node.person, thumbUrl: thumbById.get(node.id) ?? null }
  }

  return {
    nodes: Array.from(nodes.values()),
    edges,
    focusPersonId: personId
  }
}
