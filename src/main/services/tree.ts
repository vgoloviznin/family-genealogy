import { eq, and, isNull, inArray } from 'drizzle-orm'
import { getDatabase } from '../db/connection'
import * as schema from '../db/schema'
import { mapPerson, attachThumbs } from './people'
import { buildProjectGraph, assignGenerationsFromFocus } from '@shared/tree-graph'
import type { TreeData, TreeEdge, TreeNode, TreeFamily } from '@shared/types'

function nodeType(focusId: string, personId: string, generation: number): TreeNode['type'] {
  if (personId === focusId) return 'focus'
  if (generation < 0) return 'ancestor'
  if (generation > 0) return 'descendant'
  return 'focus'
}

export async function getTree(personId: string, _generations?: number): Promise<TreeData> {
  const db = getDatabase()

  const peopleRows = await db
    .select()
    .from(schema.people)
    .where(isNull(schema.people.deletedAt))

  const focusRow = peopleRows.find((p) => p.id === personId)
  if (!focusRow) throw new Error('Person not found')

  const families = await db
    .select()
    .from(schema.families)
    .where(isNull(schema.families.deletedAt))

  const familyIds = families.map((f) => f.id)
  const partnersByFamily = new Map<string, string[]>()
  const childrenByFamily = new Map<string, string[]>()

  if (familyIds.length > 0) {
    const partnerRows = await db
      .select()
      .from(schema.familyPartners)
      .where(and(inArray(schema.familyPartners.familyId, familyIds), isNull(schema.familyPartners.deletedAt)))

    const childRows = await db
      .select()
      .from(schema.familyChildren)
      .where(and(inArray(schema.familyChildren.familyId, familyIds), isNull(schema.familyChildren.deletedAt)))

    for (const row of partnerRows) {
      const list = partnersByFamily.get(row.familyId) ?? []
      list.push(row.personId)
      partnersByFamily.set(row.familyId, list)
    }

    for (const row of childRows) {
      const list = childrenByFamily.get(row.familyId) ?? []
      list.push(row.personId)
      childrenByFamily.set(row.familyId, list)
    }
  }

  const graph = buildProjectGraph(partnersByFamily, childrenByFamily)
  const allPersonIds = peopleRows.map((p) => p.id)
  const generations = assignGenerationsFromFocus(personId, allPersonIds, graph.partnerPairs, graph.parentPairs)

  const peopleById = new Map(peopleRows.map((row) => [row.id, mapPerson(row)]))

  const nodes: TreeNode[] = allPersonIds.map((id) => {
    const generation = generations.get(id) ?? 0
    return {
      id,
      person: peopleById.get(id)!,
      type: nodeType(personId, id, generation),
      generation
    }
  })

  const edges: TreeEdge[] = []
  for (const [a, b] of graph.partnerPairs) {
    edges.push({ id: [a, b].sort().join('<->'), source: a, target: b, kind: 'partner' })
  }
  for (const [parent, child] of graph.parentPairs) {
    edges.push({ id: `${parent}->${child}`, source: parent, target: child, kind: 'parent' })
  }
  for (const [a, b] of graph.siblingPairs) {
    edges.push({ id: [a, b].sort().join('~'), source: a, target: b, kind: 'sibling' })
  }

  const withThumbs = await attachThumbs(nodes.map((n) => n.person))
  const thumbById = new Map(withThumbs.map((p) => [p.id, p.thumbUrl]))
  for (const node of nodes) {
    node.person = { ...node.person, thumbUrl: thumbById.get(node.id) ?? null }
  }

  const treeFamilies: TreeFamily[] = families.map((family) => ({
    id: family.id,
    partners: partnersByFamily.get(family.id) ?? [],
    children: childrenByFamily.get(family.id) ?? []
  }))

  return {
    nodes,
    edges,
    families: treeFamilies,
    focusPersonId: personId
  }
}
