import { assignGenerationsFromFocus } from './tree-graph'

export const PEDIGREE_NODE_W = 210
export const PEDIGREE_NODE_H = 150
export const PEDIGREE_CARD_H = 64
export const PEDIGREE_COUPLE_GAP = 40
export const PEDIGREE_SIBLING_GAP = 56
export const PEDIGREE_FAMILY_GAP = 120

export interface TreeFamily {
  id: string
  partners: string[]
  children: string[]
}

export interface PedigreeLayoutInput {
  nodeIds: string[]
  focusId?: string
  families: TreeFamily[]
  partnerPairs: Array<[string, string]>
}

function parentPairsFromFamilies(families: TreeFamily[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = []
  for (const family of families) {
    for (const parent of family.partners) {
      for (const child of family.children) pairs.push([parent, child])
    }
  }
  return pairs
}

function partnerAt(id: string, generation: number, partnerPairs: Array<[string, string]>, generations: Map<string, number>): string | null {
  for (const [a, b] of partnerPairs) {
    if (a === id && generations.get(b) === generation) return b
    if (b === id && generations.get(a) === generation) return a
  }
  return null
}

function coupleWidth(count: number): number {
  if (count <= 1) return PEDIGREE_NODE_W
  return count * PEDIGREE_NODE_W + (count - 1) * PEDIGREE_COUPLE_GAP
}

/** Поколения: от фокуса, дети строго ниже родителей, супруги в одном ряду */
export function assignLayoutGenerations(
  nodeIds: string[],
  parentPairs: Array<[string, string]>,
  partnerPairs: Array<[string, string]>,
  focusId?: string
): Map<string, number> {
  const anchor = focusId && nodeIds.includes(focusId) ? focusId : nodeIds[0]
  const gen = assignGenerationsFromFocus(anchor, nodeIds, partnerPairs, parentPairs)

  let changed = true
  while (changed) {
    changed = false
    for (const [a, b] of partnerPairs) {
      if (!gen.has(a) || !gen.has(b)) continue
      const g = Math.min(gen.get(a)!, gen.get(b)!)
      if (gen.get(a) !== g) {
        gen.set(a, g)
        changed = true
      }
      if (gen.get(b) !== g) {
        gen.set(b, g)
        changed = true
      }
    }
    for (const [parent, child] of parentPairs) {
      if (!gen.has(parent)) continue
      const want = gen.get(parent)! + 1
      if (!gen.has(child) || gen.get(child)! < want) {
        gen.set(child, want)
        changed = true
      }
    }
  }

  return gen
}

function partnerFamilies(personId: string, families: TreeFamily[]): TreeFamily[] {
  return families.filter((f) => f.partners.includes(personId) && f.children.length > 0)
}

function rootFamilies(families: TreeFamily[]): TreeFamily[] {
  const children = new Set(families.flatMap((f) => f.children))
  return families.filter((f) => f.partners.some((p) => !children.has(p)))
}

function measureChildSlot(
  childId: string,
  generations: Map<string, number>,
  partnerPairs: Array<[string, string]>,
  families: TreeFamily[],
  widths: Map<string, number>,
  measuring: Set<string>
): number {
  const cached = widths.get(`child:${childId}`)
  if (cached != null) return cached

  const gen = generations.get(childId) ?? 0
  const spouse = partnerAt(childId, gen, partnerPairs, generations)
  let width = spouse ? coupleWidth(2) : PEDIGREE_NODE_W

  for (const family of partnerFamilies(childId, families)) {
    width = Math.max(width, measureFamily(family, generations, partnerPairs, families, widths, measuring))
  }
  if (spouse) {
    for (const family of partnerFamilies(spouse, families)) {
      width = Math.max(width, measureFamily(family, generations, partnerPairs, families, widths, measuring))
    }
  }

  widths.set(`child:${childId}`, width)
  return width
}

function measureFamily(
  family: TreeFamily,
  generations: Map<string, number>,
  partnerPairs: Array<[string, string]>,
  families: TreeFamily[],
  widths: Map<string, number>,
  measuring: Set<string>
): number {
  if (widths.has(family.id)) return widths.get(family.id)!
  if (measuring.has(family.id)) return coupleWidth(Math.max(family.partners.length, 1))
  measuring.add(family.id)

  const partnerRow = coupleWidth(Math.max(family.partners.length, 1))
  if (family.children.length === 0) {
    widths.set(family.id, partnerRow)
    measuring.delete(family.id)
    return partnerRow
  }

  let childrenRow = 0
  for (let i = 0; i < family.children.length; i++) {
    childrenRow += measureChildSlot(family.children[i], generations, partnerPairs, families, widths, measuring)
    if (i > 0) childrenRow += PEDIGREE_SIBLING_GAP
  }

  const width = Math.max(partnerRow, childrenRow)
  widths.set(family.id, width)
  measuring.delete(family.id)
  return width
}

function placePartnerRow(partners: string[], centerX: number, y: number, positions: Map<string, { x: number; y: number }>, placed: Set<string>) {
  const rowWidth = coupleWidth(Math.max(partners.length, 1))
  let x = centerX - rowWidth / 2 + PEDIGREE_NODE_W / 2
  for (const id of partners) {
    positions.set(id, { x, y })
    placed.add(id)
    x += PEDIGREE_NODE_W + PEDIGREE_COUPLE_GAP
  }
}

function centerPartnersAboveChildren(family: TreeFamily, positions: Map<string, { x: number; y: number }>, generations: Map<string, number>) {
  const childXs = family.children.map((id) => positions.get(id)?.x).filter((x): x is number => x != null)
  if (childXs.length === 0 || family.partners.length === 0) return

  const midX = (Math.min(...childXs) + Math.max(...childXs)) / 2
  const gen = Math.min(...family.partners.map((p) => generations.get(p) ?? 0))
  const y = gen * PEDIGREE_NODE_H
  const rowWidth = coupleWidth(family.partners.length)
  let x = midX - rowWidth / 2 + PEDIGREE_NODE_W / 2
  for (const id of family.partners) {
    positions.set(id, { x, y })
    x += PEDIGREE_NODE_W + PEDIGREE_COUPLE_GAP
  }
}

function placeChild(
  childId: string,
  centerX: number,
  generations: Map<string, number>,
  partnerPairs: Array<[string, string]>,
  families: TreeFamily[],
  positions: Map<string, { x: number; y: number }>,
  placed: Set<string>,
  widths: Map<string, number>
) {
  const gen = generations.get(childId) ?? 0
  const y = gen * PEDIGREE_NODE_H
  const spouse = partnerAt(childId, gen, partnerPairs, generations)

  if (!placed.has(childId)) {
    if (spouse && !placed.has(spouse)) {
      const rowWidth = coupleWidth(2)
      positions.set(childId, { x: centerX - rowWidth / 2 + PEDIGREE_NODE_W / 2, y })
      positions.set(spouse, { x: centerX + rowWidth / 2 - PEDIGREE_NODE_W / 2, y })
      placed.add(childId)
      placed.add(spouse)
    } else {
      positions.set(childId, { x: centerX, y })
      placed.add(childId)
    }
  }

  const members = spouse ? [childId, spouse] : [childId]
  const seen = new Set<string>()
  for (const member of members) {
    for (const family of partnerFamilies(member, families)) {
      if (seen.has(family.id)) continue
      seen.add(family.id)
      placeFamily(family, centerX, generations, partnerPairs, families, positions, placed, widths)
    }
  }
}

function placeFamily(
  family: TreeFamily,
  centerX: number,
  generations: Map<string, number>,
  partnerPairs: Array<[string, string]>,
  families: TreeFamily[],
  positions: Map<string, { x: number; y: number }>,
  placed: Set<string>,
  widths: Map<string, number>
) {
  const gen = Math.min(...family.partners.map((p) => generations.get(p) ?? 0))
  placePartnerRow(family.partners, centerX, gen * PEDIGREE_NODE_H, positions, placed)

  if (family.children.length === 0) return

  const childGen = gen + 1
  const childWidths = family.children.map((childId) => widths.get(`child:${childId}`) ?? measureChildSlot(childId, generations, partnerPairs, families, widths, new Set()))
  const totalWidth = childWidths.reduce((sum, w, i) => sum + w + (i > 0 ? PEDIGREE_SIBLING_GAP : 0), 0)
  let cursor = centerX - totalWidth / 2

  for (let i = 0; i < family.children.length; i++) {
    const childId = family.children[i]
    const slotW = childWidths[i]
    placeChild(childId, cursor + slotW / 2, generations, partnerPairs, families, positions, placed, widths)
    cursor += slotW + PEDIGREE_SIBLING_GAP
  }

  centerPartnersAboveChildren(family, positions, generations)
}

export function layoutPedigreeTree(input: PedigreeLayoutInput): Map<string, { x: number; y: number }> {
  const parentPairs = parentPairsFromFamilies(input.families)
  const generations = assignLayoutGenerations(input.nodeIds, parentPairs, input.partnerPairs, input.focusId)
  const widths = new Map<string, number>()
  const positions = new Map<string, { x: number; y: number }>()
  const placed = new Set<string>()

  const roots = rootFamilies(input.families)
  const sortedRoots = [...roots].sort((a, b) => {
    const ga = Math.min(...a.partners.map((p) => generations.get(p) ?? 0))
    const gb = Math.min(...b.partners.map((p) => generations.get(p) ?? 0))
    return ga - gb || a.id.localeCompare(b.id)
  })

  let cursor = 0
  for (const family of sortedRoots) {
    const width = measureFamily(family, generations, input.partnerPairs, input.families, widths, new Set())
    placeFamily(family, cursor + width / 2, generations, input.partnerPairs, input.families, positions, placed, widths)
    cursor += width + PEDIGREE_FAMILY_GAP
  }

  for (const id of input.nodeIds) {
    if (placed.has(id)) continue
    positions.set(id, { x: cursor, y: (generations.get(id) ?? 0) * PEDIGREE_NODE_H })
    placed.add(id)
    cursor += PEDIGREE_NODE_W + PEDIGREE_FAMILY_GAP
  }

  if (positions.size > 0) {
    const xs = [...positions.values()].map((p) => p.x)
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2
    for (const [id, point] of positions) {
      positions.set(id, { x: point.x - centerX, y: point.y })
    }
  }

  return positions
}

export interface FamilyPoint {
  id: string
  x: number
  y: number
}

export interface FamilyConnector {
  familyId: string
  unionX: number
  unionY: number
  childBarY: number
  parents: FamilyPoint[]
  children: FamilyPoint[]
}

function pointsFor(ids: string[], positions: Map<string, { x: number; y: number }>): FamilyPoint[] {
  const points: FamilyPoint[] = []
  for (const id of ids) {
    const pos = positions.get(id)
    if (pos) points.push({ id, x: pos.x, y: pos.y })
  }
  return points
}

/** Геометрия «вилки» семьи: брак под родителями, дети от перекладины */
export function buildFamilyConnectors(
  families: TreeFamily[],
  positions: Map<string, { x: number; y: number }>
): FamilyConnector[] {
  const connectors: FamilyConnector[] = []

  for (const family of families) {
    const parents = pointsFor(family.partners, positions)
    const children = pointsFor(family.children, positions)
    if (parents.length === 0 || children.length === 0) continue

    const parentBottom = Math.min(...parents.map((p) => p.y)) + PEDIGREE_CARD_H
    const childTop = Math.min(...children.map((c) => c.y))
    const gap = Math.max(24, childTop - parentBottom)
    const unionX = parents.reduce((sum, p) => sum + p.x, 0) / parents.length

    let unionY: number
    let childBarY: number
    if (parents.length >= 2) {
      unionY = parentBottom + Math.min(20, gap * 0.25)
      childBarY = childTop - Math.min(20, gap * 0.25)
    } else {
      unionY = childBarY = parentBottom + gap / 2
    }

    connectors.push({ familyId: family.id, unionX, unionY, childBarY, parents, children })
  }

  return connectors
}

export function familyConnectorPath(connector: FamilyConnector): string {
  const parts: string[] = []

  for (const parent of connector.parents) {
    parts.push(`M ${parent.x} ${parent.y + PEDIGREE_CARD_H} L ${parent.x} ${connector.unionY}`)
  }

  if (connector.parents.length >= 2) {
    const xs = connector.parents.map((p) => p.x)
    parts.push(`M ${Math.min(...xs)} ${connector.unionY} L ${Math.max(...xs)} ${connector.unionY}`)
  }

  parts.push(`M ${connector.unionX} ${connector.unionY} L ${connector.unionX} ${connector.childBarY}`)

  const childXs = connector.children.map((c) => c.x)
  const barLeft = Math.min(connector.unionX, ...childXs)
  const barRight = Math.max(connector.unionX, ...childXs)
  if (barRight - barLeft > 1) {
    parts.push(`M ${barLeft} ${connector.childBarY} L ${barRight} ${connector.childBarY}`)
  }

  for (const child of connector.children) {
    parts.push(`M ${child.x} ${connector.childBarY} L ${child.x} ${child.y}`)
  }

  return parts.join(' ')
}

export function standalonePartnerPairs(
  partnerPairs: Array<[string, string]>,
  families: TreeFamily[]
): Array<[string, string]> {
  const withChildren = new Set<string>()
  for (const family of families) {
    if (family.children.length === 0 || family.partners.length < 2) continue
    for (let i = 0; i < family.partners.length; i++) {
      for (let j = i + 1; j < family.partners.length; j++) {
        withChildren.add([family.partners[i], family.partners[j]].sort().join('|'))
      }
    }
  }

  return partnerPairs.filter(([a, b]) => !withChildren.has([a, b].sort().join('|')))
}

export function partnerLineCoords(
  a: { x: number; y: number },
  b: { x: number; y: number }
): { x1: number; y1: number; x2: number; y2: number } {
  const left = a.x <= b.x ? a : b
  const right = a.x <= b.x ? b : a
  const y = Math.min(left.y, right.y) + PEDIGREE_CARD_H / 2
  return {
    x1: left.x + PEDIGREE_NODE_W / 2,
    y1: y,
    x2: right.x - PEDIGREE_NODE_W / 2,
    y2: y
  }
}
