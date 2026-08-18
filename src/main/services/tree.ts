import { eq, and, isNull, inArray } from 'drizzle-orm'
import { getDatabase } from '../db/connection'
import * as schema from '../db/schema'
import { mapPerson, attachThumbs, loadLifeYears } from './people'
import { buildProjectGraph, assignGenerationsFromFocus, defaultTreeFocusId } from '@shared/tree-graph'
import type { TreeData, TreeEdge, TreeNode, TreeFamily } from '@shared/types'

function nodeType(focusId: string | null, personId: string, generation: number): TreeNode['type'] {
  if (!focusId) return 'focus'
  if (personId === focusId) return 'focus'
  if (generation < 0) return 'ancestor'
  if (generation > 0) return 'descendant'
  return 'focus'
}

export async function getTree(personId?: string | null, _generations?: number): Promise<TreeData> {
  const db = getDatabase()

  const peopleRows = await db
    .select()
    .from(schema.people)
    .where(isNull(schema.people.deletedAt))

  if (peopleRows.length === 0) {
    return { nodes: [], edges: [], families: [], focusPersonId: null }
  }

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
  const treeFamilies: TreeFamily[] = families.map((family) => ({
    id: family.id,
    partners: partnersByFamily.get(family.id) ?? [],
    children: childrenByFamily.get(family.id) ?? []
  }))
  const userFocus = personId && allPersonIds.includes(personId) ? personId : null
  const layoutFocus =
    userFocus ?? defaultTreeFocusId(allPersonIds, treeFamilies.flatMap((family) => family.children)) ?? allPersonIds[0]
  const generations = assignGenerationsFromFocus(layoutFocus, allPersonIds, graph.partnerPairs, graph.parentPairs)

  const life = await loadLifeYears(allPersonIds)
  const peopleById = new Map(peopleRows.map((row) => [row.id, mapPerson(row, life.get(row.id))]))

  const nodes: TreeNode[] = allPersonIds.map((id) => {
    const generation = generations.get(id) ?? 0
    return {
      id,
      person: peopleById.get(id)!,
      type: nodeType(userFocus, id, generation),
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

  return {
    nodes,
    edges,
    families: treeFamilies,
    focusPersonId: userFocus
  }
}
