import { assignGenerationsFromFocus } from './tree-graph';

export const PEDIGREE_NODE_MIN_W = 148;
export const PEDIGREE_NODE_MAX_W = 320;
/** @deprecated use PEDIGREE_NODE_MIN_W */
export const PEDIGREE_NODE_W = PEDIGREE_NODE_MIN_W;
export const PEDIGREE_NODE_H = 96;
export const PEDIGREE_CARD_H = 52;
export const PEDIGREE_COUPLE_GAP = 28;
export const PEDIGREE_SIBLING_GAP = 40;
export const PEDIGREE_FAMILY_GAP = 80;
export const PEDIGREE_ROW_GAP = 16;

const CARD_CHROME_W = 64; // avatar 32 + gap 8 + padding 16 + safety
const CHAR_W_PRIMARY = 8;
const CHAR_W_SECONDARY = 7.5;

export interface PersonNameLines {
  primary: string;
  secondary: string | null;
}

export function compactNameLines(person: { firstName: string; lastName: string; middleName?: string | null }, emptyNameLabel = ''): PersonNameLines {
  const last = person.lastName.trim();
  const given = [person.firstName, person.middleName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  if (last && given) {
    return { primary: last, secondary: given };
  }
  if (last) {
    return { primary: last, secondary: null };
  }
  if (given) {
    return { primary: given, secondary: null };
  }
  const full = [last, person.firstName, person.middleName].filter(Boolean).join(' ').trim();
  return { primary: full || emptyNameLabel, secondary: null };
}

export function estimatePedigreeCardWidth(lines: PersonNameLines): number {
  const primaryW = lines.primary.length * CHAR_W_PRIMARY;
  const secondaryW = lines.secondary ? lines.secondary.length * CHAR_W_SECONDARY : 0;
  const textW = Math.max(primaryW, secondaryW);
  return Math.min(PEDIGREE_NODE_MAX_W, Math.max(PEDIGREE_NODE_MIN_W, Math.ceil(textW + CARD_CHROME_W)));
}

export function buildPedigreeNodeWidths(
  people: Array<{ id: string; firstName: string; lastName: string; middleName?: string | null }>,
  emptyNameLabel = ''
): Map<string, number> {
  const widths = new Map<string, number>();
  for (const person of people) {
    widths.set(person.id, estimatePedigreeCardWidth(compactNameLines(person, emptyNameLabel)));
  }
  return widths;
}

function nodeWidth(id: string, nodeWidths: Map<string, number>): number {
  return nodeWidths.get(id) ?? PEDIGREE_NODE_MIN_W;
}

function coupleWidthForIds(ids: string[], nodeWidths: Map<string, number>): number {
  if (ids.length === 0) {
    return PEDIGREE_NODE_MIN_W;
  }
  return ids.reduce((sum, id, i) => sum + nodeWidth(id, nodeWidths) + (i > 0 ? PEDIGREE_COUPLE_GAP : 0), 0);
}

export interface TreeFamily {
  id: string;
  partners: string[];
  children: string[];
}

export interface PedigreeLayoutInput {
  nodeIds: string[];
  focusId?: string;
  families: TreeFamily[];
  partnerPairs: Array<[string, string]>;
  nodeWidths?: Map<string, number>;
}

function parentPairsFromFamilies(families: TreeFamily[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (const family of families) {
    for (const parent of family.partners) {
      for (const child of family.children) {
        pairs.push([parent, child]);
      }
    }
  }
  return pairs;
}

function partnerAt(id: string, generation: number, partnerPairs: Array<[string, string]>, generations: Map<string, number>): string | null {
  for (const [a, b] of partnerPairs) {
    if (a === id && generations.get(b) === generation) {
      return b;
    }
    if (b === id && generations.get(a) === generation) {
      return a;
    }
  }
  return null;
}

/** Поколения: от фокуса, дети строго ниже родителей, супруги в одном ряду */
export function assignLayoutGenerations(
  nodeIds: string[],
  parentPairs: Array<[string, string]>,
  partnerPairs: Array<[string, string]>,
  focusId?: string
): Map<string, number> {
  const anchor = focusId && nodeIds.includes(focusId) ? focusId : nodeIds[0];
  const gen = assignGenerationsFromFocus(anchor, nodeIds, partnerPairs, parentPairs);

  let changed = true;
  while (changed) {
    changed = false;
    for (const [a, b] of partnerPairs) {
      if (!gen.has(a) || !gen.has(b)) {
        continue;
      }
      const g = Math.min(gen.get(a)!, gen.get(b)!);
      if (gen.get(a) !== g) {
        gen.set(a, g);
        changed = true;
      }
      if (gen.get(b) !== g) {
        gen.set(b, g);
        changed = true;
      }
    }
    for (const [parent, child] of parentPairs) {
      if (!gen.has(parent)) {
        continue;
      }
      const want = gen.get(parent)! + 1;
      if (!gen.has(child) || gen.get(child)! < want) {
        gen.set(child, want);
        changed = true;
      }
    }
  }

  return gen;
}

function partnerFamilies(personId: string, families: TreeFamily[]): TreeFamily[] {
  return families.filter((f) => f.partners.includes(personId) && f.children.length > 0);
}

function rootFamilies(families: TreeFamily[]): TreeFamily[] {
  const children = new Set(families.flatMap((f) => f.children));
  return families.filter((f) => f.partners.some((p) => !children.has(p)));
}

function measureChildSlot(
  childId: string,
  generations: Map<string, number>,
  partnerPairs: Array<[string, string]>,
  families: TreeFamily[],
  widths: Map<string, number>,
  nodeWidths: Map<string, number>,
  measuring: Set<string>
): number {
  const cached = widths.get(`child:${childId}`);
  if (cached != null) {
    return cached;
  }

  const gen = generations.get(childId) ?? 0;
  const spouse = partnerAt(childId, gen, partnerPairs, generations);
  let width = spouse ? nodeWidth(childId, nodeWidths) + PEDIGREE_COUPLE_GAP + nodeWidth(spouse, nodeWidths) : nodeWidth(childId, nodeWidths);

  for (const family of partnerFamilies(childId, families)) {
    width = Math.max(width, measureFamily(family, generations, partnerPairs, families, widths, nodeWidths, measuring));
  }
  if (spouse) {
    for (const family of partnerFamilies(spouse, families)) {
      width = Math.max(width, measureFamily(family, generations, partnerPairs, families, widths, nodeWidths, measuring));
    }
  }

  widths.set(`child:${childId}`, width);
  return width;
}

function measureFamily(
  family: TreeFamily,
  generations: Map<string, number>,
  partnerPairs: Array<[string, string]>,
  families: TreeFamily[],
  widths: Map<string, number>,
  nodeWidths: Map<string, number>,
  measuring: Set<string>
): number {
  if (widths.has(family.id)) {
    return widths.get(family.id)!;
  }
  if (measuring.has(family.id)) {
    return coupleWidthForIds(family.partners, nodeWidths);
  }
  measuring.add(family.id);

  const partnerRow = coupleWidthForIds(family.partners, nodeWidths);
  if (family.children.length === 0) {
    widths.set(family.id, partnerRow);
    measuring.delete(family.id);
    return partnerRow;
  }

  let childrenRow = 0;
  for (let i = 0; i < family.children.length; i++) {
    childrenRow += measureChildSlot(family.children[i], generations, partnerPairs, families, widths, nodeWidths, measuring);
    if (i > 0) {
      childrenRow += PEDIGREE_SIBLING_GAP;
    }
  }

  const width = Math.max(partnerRow, childrenRow);
  widths.set(family.id, width);
  measuring.delete(family.id);
  return width;
}

function placePartnerRow(
  partners: string[],
  centerX: number,
  y: number,
  positions: Map<string, { x: number; y: number }>,
  placed: Set<string>,
  nodeWidths: Map<string, number>
) {
  const rowWidth = coupleWidthForIds(partners, nodeWidths);
  let x = centerX - rowWidth / 2;
  for (const id of partners) {
    const w = nodeWidth(id, nodeWidths);
    positions.set(id, { x: x + w / 2, y });
    placed.add(id);
    x += w + PEDIGREE_COUPLE_GAP;
  }
}

function centerPartnersAboveChildren(
  family: TreeFamily,
  positions: Map<string, { x: number; y: number }>,
  generations: Map<string, number>,
  nodeWidths: Map<string, number>
) {
  const childXs = family.children.map((id) => positions.get(id)?.x).filter((x): x is number => x != null);
  if (childXs.length === 0 || family.partners.length === 0) {
    return;
  }

  const midX = (Math.min(...childXs) + Math.max(...childXs)) / 2;
  const gen = Math.min(...family.partners.map((p) => generations.get(p) ?? 0));
  const y = gen * PEDIGREE_NODE_H;
  const rowWidth = coupleWidthForIds(family.partners, nodeWidths);
  let x = midX - rowWidth / 2;
  for (const id of family.partners) {
    const w = nodeWidth(id, nodeWidths);
    positions.set(id, { x: x + w / 2, y });
    x += w + PEDIGREE_COUPLE_GAP;
  }
}

function cardLeft(id: string, positions: Map<string, { x: number; y: number }>, nodeWidths: Map<string, number>): number {
  return positions.get(id)!.x - nodeWidth(id, nodeWidths) / 2;
}

function cardRight(id: string, positions: Map<string, { x: number; y: number }>, nodeWidths: Map<string, number>): number {
  return positions.get(id)!.x + nodeWidth(id, nodeWidths) / 2;
}

function coupleBlockWidth(id: string, spouse: string | null, nodeWidths: Map<string, number>): number {
  if (!spouse) {
    return nodeWidth(id, nodeWidths);
  }
  return nodeWidth(id, nodeWidths) + PEDIGREE_COUPLE_GAP + nodeWidth(spouse, nodeWidths);
}

/** Сдвигает всех, кто правее якоря — относительная геометрия дерева сохраняется */
function shiftTreeRightFrom(minX: number, dx: number, positions: Map<string, { x: number; y: number }>) {
  for (const [id, pos] of positions) {
    if (pos.x >= minX - 0.01) {
      positions.set(id, { x: pos.x + dx, y: pos.y });
    }
  }
}

/** Раздвигает пересекающиеся карточки слева направо, не разрывая пары */
function resolveGenerationOverlaps(
  nodeIds: string[],
  generations: Map<string, number>,
  positions: Map<string, { x: number; y: number }>,
  nodeWidths: Map<string, number>
) {
  const gens = [...new Set([...generations.values()])].sort((a, b) => a - b);
  for (const g of gens) {
    const ids = nodeIds.filter((id) => positions.has(id) && (generations.get(id) ?? 0) === g);
    const sorted = [...ids].sort((a, b) => cardLeft(a, positions, nodeWidths) - cardLeft(b, positions, nodeWidths));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const gap = cardLeft(curr, positions, nodeWidths) - cardRight(prev, positions, nodeWidths);
      if (gap >= PEDIGREE_ROW_GAP) {
        continue;
      }
      const dx = PEDIGREE_ROW_GAP - gap;
      shiftTreeRightFrom(positions.get(curr)!.x, dx, positions);
    }
  }
}

function rightEdge(
  personId: string,
  positions: Map<string, { x: number; y: number }>,
  nodeWidths: Map<string, number>,
  generation: number,
  partnerPairs: Array<[string, string]>,
  generations: Map<string, number>,
  placed: Set<string>
): number {
  const pos = positions.get(personId);
  if (!pos) {
    return 0;
  }
  let edge = pos.x + nodeWidth(personId, nodeWidths) / 2;
  const spouse = partnerAt(personId, generation, partnerPairs, generations);
  if (spouse && placed.has(spouse) && positions.has(spouse)) {
    const spousePos = positions.get(spouse)!;
    edge = Math.max(edge, spousePos.x + nodeWidth(spouse, nodeWidths) / 2);
  }
  return edge;
}

/** Дети уже на месте (через брак/другую ветку) — достраиваем родителей и сиблингов */
function attachFamilyToPlacedChildren(
  family: TreeFamily,
  generations: Map<string, number>,
  partnerPairs: Array<[string, string]>,
  families: TreeFamily[],
  positions: Map<string, { x: number; y: number }>,
  placed: Set<string>,
  widths: Map<string, number>,
  nodeWidths: Map<string, number>
) {
  const placedKids = family.children.filter((c) => placed.has(c));
  const unplacedKids = family.children.filter((c) => !placed.has(c));
  if (placedKids.length === 0) {
    return;
  }

  const childGen = generations.get(family.children[0]) ?? 0;

  if (unplacedKids.length > 0) {
    let cursor = Math.max(...placedKids.map((c) => rightEdge(c, positions, nodeWidths, childGen, partnerPairs, generations, placed)));
    for (const childId of unplacedKids) {
      const spouse = partnerAt(childId, childGen, partnerPairs, generations);
      const slotW = widths.get(`child:${childId}`) ?? coupleBlockWidth(childId, spouse && !placed.has(spouse) ? spouse : null, nodeWidths);
      const centerX = cursor + PEDIGREE_SIBLING_GAP + slotW / 2;
      placeChild(childId, centerX, generations, partnerPairs, families, positions, placed, widths, nodeWidths);
      cursor = rightEdge(childId, positions, nodeWidths, childGen, partnerPairs, generations, placed);
    }
  }

  centerPartnersAboveChildren(family, positions, generations, nodeWidths);
  for (const id of [...family.partners, ...family.children]) {
    placed.add(id);
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
  widths: Map<string, number>,
  nodeWidths: Map<string, number>
) {
  const gen = generations.get(childId) ?? 0;
  const y = gen * PEDIGREE_NODE_H;
  const spouse = partnerAt(childId, gen, partnerPairs, generations);

  if (!placed.has(childId)) {
    if (spouse && !placed.has(spouse)) {
      const w1 = nodeWidth(childId, nodeWidths);
      const w2 = nodeWidth(spouse, nodeWidths);
      const rowWidth = w1 + PEDIGREE_COUPLE_GAP + w2;
      positions.set(childId, { x: centerX - rowWidth / 2 + w1 / 2, y });
      positions.set(spouse, { x: centerX + rowWidth / 2 - w2 / 2, y });
      placed.add(childId);
      placed.add(spouse);
    } else {
      positions.set(childId, { x: centerX, y });
      placed.add(childId);
    }
  }

  const members = spouse ? [childId, spouse] : [childId];
  const seen = new Set<string>();
  for (const member of members) {
    for (const family of partnerFamilies(member, families)) {
      if (seen.has(family.id)) {
        continue;
      }
      seen.add(family.id);
      placeFamily(family, centerX, generations, partnerPairs, families, positions, placed, widths, nodeWidths);
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
  widths: Map<string, number>,
  nodeWidths: Map<string, number>
) {
  if (family.children.some((c) => placed.has(c))) {
    attachFamilyToPlacedChildren(family, generations, partnerPairs, families, positions, placed, widths, nodeWidths);
    return;
  }

  const gen = Math.min(...family.partners.map((p) => generations.get(p) ?? 0));
  if (!family.partners.some((p) => placed.has(p))) {
    placePartnerRow(family.partners, centerX, gen * PEDIGREE_NODE_H, positions, placed, nodeWidths);
  }

  if (family.children.length === 0) {
    return;
  }

  const childWidths = family.children.map(
    (childId) => widths.get(`child:${childId}`) ?? measureChildSlot(childId, generations, partnerPairs, families, widths, nodeWidths, new Set())
  );
  const totalWidth = childWidths.reduce((sum, w, i) => sum + w + (i > 0 ? PEDIGREE_SIBLING_GAP : 0), 0);
  let cursor = centerX - totalWidth / 2;

  for (let i = 0; i < family.children.length; i++) {
    const childId = family.children[i];
    const slotW = childWidths[i];
    placeChild(childId, cursor + slotW / 2, generations, partnerPairs, families, positions, placed, widths, nodeWidths);
    cursor += slotW + PEDIGREE_SIBLING_GAP;
  }

  centerPartnersAboveChildren(family, positions, generations, nodeWidths);
  for (const id of family.partners) {
    placed.add(id);
  }
}

export function layoutPedigreeTree(input: PedigreeLayoutInput): Map<string, { x: number; y: number }> {
  const parentPairs = parentPairsFromFamilies(input.families);
  const generations = assignLayoutGenerations(input.nodeIds, parentPairs, input.partnerPairs, input.focusId);
  const nodeWidths = input.nodeWidths ?? new Map<string, number>();
  const widths = new Map<string, number>();
  const positions = new Map<string, { x: number; y: number }>();
  const placed = new Set<string>();

  const roots = rootFamilies(input.families);
  const sortedRoots = [...roots].sort((a, b) => {
    const ga = Math.min(...a.partners.map((p) => generations.get(p) ?? 0));
    const gb = Math.min(...b.partners.map((p) => generations.get(p) ?? 0));
    return ga - gb || a.id.localeCompare(b.id);
  });

  let cursor = 0;
  for (const family of sortedRoots) {
    if (family.children.some((c) => placed.has(c))) {
      attachFamilyToPlacedChildren(family, generations, input.partnerPairs, input.families, positions, placed, widths, nodeWidths);
      continue;
    }

    const width = measureFamily(family, generations, input.partnerPairs, input.families, widths, nodeWidths, new Set());
    placeFamily(family, cursor + width / 2, generations, input.partnerPairs, input.families, positions, placed, widths, nodeWidths);
    cursor += width + PEDIGREE_FAMILY_GAP;
  }

  for (const id of input.nodeIds) {
    if (placed.has(id)) {
      continue;
    }
    const w = nodeWidth(id, nodeWidths);
    positions.set(id, { x: cursor + w / 2, y: (generations.get(id) ?? 0) * PEDIGREE_NODE_H });
    placed.add(id);
    cursor += w + PEDIGREE_FAMILY_GAP;
  }

  resolveGenerationOverlaps(input.nodeIds, generations, positions, nodeWidths);

  if (positions.size > 0) {
    const xs = [...positions.values()].map((p) => p.x);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    for (const [id, point] of positions) {
      positions.set(id, { x: point.x - centerX, y: point.y });
    }
  }

  return positions;
}

export interface FamilyPoint {
  id: string;
  x: number;
  y: number;
}

export interface FamilyConnector {
  familyId: string;
  unionX: number;
  unionY: number;
  childBarY: number;
  parents: FamilyPoint[];
  children: FamilyPoint[];
}

export type TreeLineKind = 'partner' | 'parent' | 'child' | 'sibling';

export interface TreeLineSegment {
  id: string;
  kind: TreeLineKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export const TREE_LINE_STYLES: Record<
  TreeLineKind,
  { stroke: string; strokeWidth: number; strokeDasharray?: string; strokeLinecap: 'square' | 'round' }
> = {
  partner: { stroke: '#dc2626', strokeWidth: 2, strokeDasharray: '6 4', strokeLinecap: 'round' },
  sibling: { stroke: '#dc2626', strokeWidth: 2, strokeLinecap: 'square' },
  parent: { stroke: '#171717', strokeWidth: 1.75, strokeLinecap: 'square' },
  child: { stroke: '#171717', strokeWidth: 1.75, strokeLinecap: 'square' }
};

const CHILD_BAR_INSET = 10;

function pointsFor(ids: string[], positions: Map<string, { x: number; y: number }>): FamilyPoint[] {
  const points: FamilyPoint[] = [];
  for (const id of ids) {
    const pos = positions.get(id);
    if (pos) {
      points.push({ id, x: pos.x, y: pos.y });
    }
  }
  return points;
}

function coupleMidX(parents: FamilyPoint[], nodeWidths: Map<string, number>): number {
  if (parents.length === 0) {
    return 0;
  }
  if (parents.length === 1) {
    return parents[0].x;
  }
  const sorted = [...parents].sort((a, b) => a.x - b.x);
  const left = sorted[0];
  const right = sorted[sorted.length - 1];
  const innerLeft = left.x + nodeWidth(left.id, nodeWidths) / 2;
  const innerRight = right.x - nodeWidth(right.id, nodeWidths) / 2;
  return (innerLeft + innerRight) / 2;
}

/** Геометрия «вилки» семьи: брак между родителями, дети от перекладины */
export function buildFamilyConnectors(
  families: TreeFamily[],
  positions: Map<string, { x: number; y: number }>,
  nodeWidths: Map<string, number> = new Map()
): FamilyConnector[] {
  const connectors: FamilyConnector[] = [];

  for (const family of families) {
    const parents = pointsFor(family.partners, positions);
    const children = pointsFor(family.children, positions);
    if (parents.length === 0 || children.length === 0) {
      continue;
    }

    const parentBottom = Math.min(...parents.map((p) => p.y)) + PEDIGREE_CARD_H;
    const childTop = Math.min(...children.map((c) => c.y));
    if (childTop <= parentBottom + 2) {
      continue;
    }

    const gap = childTop - parentBottom;
    const unionX = coupleMidX(parents, nodeWidths);
    const childBarY = childTop - Math.min(CHILD_BAR_INSET, Math.max(6, gap * 0.22));
    const unionY = parents.length >= 2 ? Math.min(...parents.map((p) => p.y)) + PEDIGREE_CARD_H / 2 : parentBottom;

    connectors.push({ familyId: family.id, unionX, unionY, childBarY, parents, children });
  }

  return connectors;
}

export function familyConnectorSegments(connector: FamilyConnector, nodeWidths: Map<string, number> = new Map()): TreeLineSegment[] {
  const segments: TreeLineSegment[] = [];
  const { familyId } = connector;

  const pushSegment = (segment: TreeLineSegment) => {
    if (Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1) < 0.5) {
      return;
    }
    segments.push(segment);
  };

  if (connector.parents.length >= 2) {
    const sorted = [...connector.parents].sort((a, b) => a.x - b.x);
    const left = sorted[0];
    const right = sorted[sorted.length - 1];
    const y = Math.min(left.y, right.y) + PEDIGREE_CARD_H / 2;
    const x1 = left.x + nodeWidth(left.id, nodeWidths) / 2;
    const x2 = right.x - nodeWidth(right.id, nodeWidths) / 2;
    pushSegment({
      id: `${familyId}-partner`,
      kind: 'partner',
      x1,
      y1: y,
      x2,
      y2: y
    });
  }

  const stemX = connector.unionX;
  pushSegment({
    id: `${familyId}-stem`,
    kind: 'parent',
    x1: stemX,
    y1: connector.unionY,
    x2: stemX,
    y2: connector.childBarY
  });

  const childXs = connector.children.map((c) => c.x);
  const barLeft = Math.min(stemX, ...childXs);
  const barRight = Math.max(stemX, ...childXs);
  if (barRight - barLeft > 0.5) {
    pushSegment({
      id: `${familyId}-child-bar`,
      kind: 'parent',
      x1: barLeft,
      y1: connector.childBarY,
      x2: barRight,
      y2: connector.childBarY
    });
  }

  for (const child of connector.children) {
    pushSegment({
      id: `${familyId}-child-${child.id}`,
      kind: 'child',
      x1: child.x,
      y1: connector.childBarY,
      x2: child.x,
      y2: child.y
    });
  }

  const siblings = [...connector.children].sort((a, b) => a.x - b.x);
  for (let i = 1; i < siblings.length; i++) {
    const left = siblings[i - 1];
    const right = siblings[i];
    const line = siblingLineCoords(left, right, nodeWidth(left.id, nodeWidths), nodeWidth(right.id, nodeWidths));
    pushSegment({
      id: `${familyId}-sibling-${left.id}|${right.id}`,
      kind: 'sibling',
      ...line
    });
  }

  return segments;
}

/** @deprecated use familyConnectorSegments */
export function familyConnectorPath(connector: FamilyConnector): string {
  return familyConnectorSegments(connector)
    .map((s) => `M ${s.x1} ${s.y1} L ${s.x2} ${s.y2}`)
    .join(' ');
}

export function standalonePartnerPairs(partnerPairs: Array<[string, string]>, families: TreeFamily[]): Array<[string, string]> {
  const skip = new Set<string>();
  for (const family of families) {
    if (family.children.length > 0 && family.partners.length >= 2) {
      for (let i = 0; i < family.partners.length; i++) {
        for (let j = i + 1; j < family.partners.length; j++) {
          skip.add([family.partners[i], family.partners[j]].sort().join('|'));
        }
      }
    }
    for (let i = 0; i < family.children.length; i++) {
      for (let j = i + 1; j < family.children.length; j++) {
        skip.add([family.children[i], family.children[j]].sort().join('|'));
      }
    }
  }

  return partnerPairs.filter(([a, b]) => !skip.has([a, b].sort().join('|')));
}

function innerEdgeLine(
  a: { x: number; y: number },
  b: { x: number; y: number },
  widthA: number,
  widthB: number,
  yOffset: number
): { x1: number; y1: number; x2: number; y2: number } {
  const left = a.x <= b.x ? a : b;
  const right = a.x <= b.x ? b : a;
  const leftW = a.x <= b.x ? widthA : widthB;
  const rightW = a.x <= b.x ? widthB : widthA;
  const y = Math.min(left.y, right.y) + yOffset;
  return {
    x1: left.x + leftW / 2,
    y1: y,
    x2: right.x - rightW / 2,
    y2: y
  };
}

export function siblingLineCoords(
  a: { x: number; y: number },
  b: { x: number; y: number },
  widthA: number,
  widthB: number
): { x1: number; y1: number; x2: number; y2: number } {
  return innerEdgeLine(a, b, widthA, widthB, PEDIGREE_CARD_H / 2);
}

export function partnerLineCoords(
  a: { x: number; y: number },
  b: { x: number; y: number },
  widthA: number,
  widthB: number
): { x1: number; y1: number; x2: number; y2: number } {
  return innerEdgeLine(a, b, widthA, widthB, PEDIGREE_CARD_H / 2);
}
