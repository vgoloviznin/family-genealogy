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

async function getSiblingIds(personId: string): Promise<string[]> {
  const db = getDatabase()
  const childLinks = await db
    .select()
    .from(schema.familyChildren)
    .where(and(eq(schema.familyChildren.personId, personId), isNull(schema.familyChildren.deletedAt)))

  const siblingIds: string[] = []
  for (const link of childLinks) {
    const children = await db
      .select()
      .from(schema.familyChildren)
      .where(and(eq(schema.familyChildren.familyId, link.familyId), isNull(schema.familyChildren.deletedAt)))
    for (const c of children) {
      if (c.personId !== personId) siblingIds.push(c.personId)
    }
  }
  return [...new Set(siblingIds)]
}

function typeForGeneration(generation: number): TreeNode['type'] {
  if (generation < 0) return 'ancestor'
  if (generation > 0) return 'descendant'
  return 'focus'
}

export async function getTree(personId: string, generations = 4): Promise<TreeData> {
  const focus = await getPersonById(personId)
  if (!focus) throw new Error('Person not found')

  const nodes = new Map<string, TreeNode>()
  const edges: TreeEdge[] = []
  const edgeSet = new Set<string>()

  const addNode = (person: Person, type: TreeNode['type'], generation: number): boolean => {
    const existing = nodes.get(person.id)
    if (!existing) {
      nodes.set(person.id, { id: person.id, person, type, generation })
      return true
    }
    if (Math.abs(generation) < Math.abs(existing.generation)) {
      existing.generation = generation
      existing.type = type
      return true
    }
    return false
  }

  const addParentEdge = (parentId: string, childId: string): void => {
    const edgeId = `${parentId}->${childId}`
    if (edgeSet.has(edgeId)) return
    edges.push({ id: edgeId, source: parentId, target: childId, kind: 'parent' })
    edgeSet.add(edgeId)
  }

  const addPartnerEdge = (a: string, b: string): void => {
    const edgeId = [a, b].sort().join('<->')
    if (edgeSet.has(edgeId)) return
    edges.push({ id: edgeId, source: a, target: b, kind: 'partner' })
    edgeSet.add(edgeId)
  }

  const addSiblingEdge = (a: string, b: string): void => {
    const edgeId = [a, b].sort().join('~')
    if (edgeSet.has(edgeId)) return
    edges.push({ id: edgeId, source: a, target: b, kind: 'sibling' })
    edgeSet.add(edgeId)
  }

  addNode(focus, 'focus', 0)

  async function walkAncestors(id: string, depth: number, nodeGen: number): Promise<void> {
    if (depth >= generations) return
    const parents = await getParentIds(id)
    for (const pid of parents) {
      const person = await getPersonById(pid)
      if (!person) continue
      const parentGen = nodeGen - 1
      addNode(person, 'ancestor', parentGen)
      await walkAncestors(pid, depth + 1, parentGen)
    }
  }

  async function walkDescendants(id: string, depth: number, nodeGen: number): Promise<void> {
    if (depth >= generations) return
    const children = await getChildIds(id)
    for (const cid of children) {
      const person = await getPersonById(cid)
      if (!person) continue
      const childGen = nodeGen + 1
      addNode(person, 'descendant', childGen)
      await walkDescendants(cid, depth + 1, childGen)
    }
  }

  await walkAncestors(personId, 0, 0)
  await walkDescendants(personId, 0, 0)

  // Супруги, братья/сёстры и родители каждого узла — в одном цикле, пока появляются новые люди
  let expanded = true
  while (expanded) {
    expanded = false
    const snapshot = [...nodes.keys()]

    for (const id of snapshot) {
      const node = nodes.get(id)!
      const gen = node.generation

      for (const pid of await getPartnerIds(id)) {
        const person = await getPersonById(pid)
        if (!person) continue
        if (addNode(person, typeForGeneration(gen), gen)) expanded = true
      }

      for (const sid of await getSiblingIds(id)) {
        const person = await getPersonById(sid)
        if (!person) continue
        if (addNode(person, typeForGeneration(gen), gen)) expanded = true
      }
    }

    for (const id of snapshot) {
      const node = nodes.get(id)!
      if (node.generation <= -generations) continue
      for (const pid of await getParentIds(id)) {
        const person = await getPersonById(pid)
        if (!person) continue
        if (addNode(person, 'ancestor', node.generation - 1)) expanded = true
      }
    }
  }

  for (const node of nodes.values()) {
    for (const pid of await getParentIds(node.id)) {
      if (nodes.has(pid)) addParentEdge(pid, node.id)
    }
    for (const pid of await getPartnerIds(node.id)) {
      if (nodes.has(pid)) addPartnerEdge(node.id, pid)
    }
    for (const sid of await getSiblingIds(node.id)) {
      if (nodes.has(sid)) addSiblingEdge(node.id, sid)
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
