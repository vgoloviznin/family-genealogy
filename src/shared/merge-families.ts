import type { MergeRowRecord } from './merge-types';

export interface FamilyCollapseDrop {
  familyId: string;
  /** Family that already contains these partners and children. */
  keeperId: string;
}

interface ActiveFamily {
  id: string;
  createdAt: string;
  partners: Set<string>;
  children: Set<string>;
}

function isDeleted(row: MergeRowRecord): boolean {
  const deletedAt = row.deleted_at;
  return deletedAt !== null && deletedAt !== undefined && deletedAt !== '';
}

function rowId(row: MergeRowRecord): string {
  return typeof row.id === 'string' ? row.id : String(row.id ?? '');
}

function field(row: MergeRowRecord, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

function isSubset(smaller: Set<string>, larger: Set<string>): boolean {
  for (const id of smaller) {
    if (!larger.has(id)) {
      return false;
    }
  }
  return true;
}

function sameMembers(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && isSubset(a, b);
}

function keeperRank(family: ActiveFamily): string {
  return `${family.createdAt}\u0000${family.id}`;
}

/** G already records every partner and child of F, and is not the same union. */
function covers(keeper: ActiveFamily, extra: ActiveFamily): boolean {
  if (extra.children.size === 0) {
    return false;
  }
  if (!isSubset(extra.partners, keeper.partners) || !isSubset(extra.children, keeper.children)) {
    return false;
  }
  if (sameMembers(extra.partners, keeper.partners) && sameMembers(extra.children, keeper.children)) {
    return false;
  }
  if (extra.partners.size === 0) {
    return keeper.partners.size > 0 || extra.children.size < keeper.children.size;
  }
  return true;
}

function membershipKey(family: ActiveFamily): string {
  const partners = [...family.partners].sort().join(',');
  const children = [...family.children].sort().join(',');
  return `${partners}|${children}`;
}

/**
 * Families that repeat the same union: identical partner/child sets, a one-parent
 * slice of a larger union, or a parentless sibling group already stored under parents.
 * The older family (then the smaller id) is kept.
 */
export function planFamilyCollapse(input: {
  families: MergeRowRecord[];
  partners: MergeRowRecord[];
  children: MergeRowRecord[];
}): FamilyCollapseDrop[] {
  const partnersByFamily = new Map<string, Set<string>>();
  const childrenByFamily = new Map<string, Set<string>>();

  for (const row of input.partners) {
    if (isDeleted(row)) {
      continue;
    }
    const familyId = field(row, 'family_id');
    const personId = field(row, 'person_id');
    if (!familyId || !personId) {
      continue;
    }
    const set = partnersByFamily.get(familyId) ?? new Set<string>();
    set.add(personId);
    partnersByFamily.set(familyId, set);
  }

  for (const row of input.children) {
    if (isDeleted(row)) {
      continue;
    }
    const familyId = field(row, 'family_id');
    const personId = field(row, 'person_id');
    if (!familyId || !personId) {
      continue;
    }
    const set = childrenByFamily.get(familyId) ?? new Set<string>();
    set.add(personId);
    childrenByFamily.set(familyId, set);
  }

  const active: ActiveFamily[] = [];
  for (const row of input.families) {
    if (isDeleted(row)) {
      continue;
    }
    const id = rowId(row);
    const partners = partnersByFamily.get(id) ?? new Set<string>();
    const children = childrenByFamily.get(id) ?? new Set<string>();
    if (partners.size === 0 && children.size === 0) {
      continue;
    }
    active.push({ id, createdAt: field(row, 'created_at'), partners, children });
  }

  const dropped = new Map<string, string>();

  const groups = new Map<string, ActiveFamily[]>();
  for (const family of active) {
    const key = membershipKey(family);
    const list = groups.get(key) ?? [];
    list.push(family);
    groups.set(key, list);
  }

  for (const group of groups.values()) {
    if (group.length < 2) {
      continue;
    }
    const [keeper, ...extras] = [...group].sort((a, b) => keeperRank(a).localeCompare(keeperRank(b)));
    for (const extra of extras) {
      dropped.set(extra.id, keeper.id);
    }
  }

  const survivors = active.filter((family) => !dropped.has(family.id));
  for (const extra of survivors) {
    const keeper = survivors.find((candidate) => candidate.id !== extra.id && covers(candidate, extra));
    if (keeper) {
      dropped.set(extra.id, keeper.id);
    }
  }

  const drops: FamilyCollapseDrop[] = [];
  for (const [familyId, keeperId] of dropped) {
    let resolved = keeperId;
    const seen = new Set<string>([familyId]);
    while (dropped.has(resolved) && !seen.has(resolved)) {
      seen.add(resolved);
      resolved = dropped.get(resolved)!;
    }
    drops.push({ familyId, keeperId: resolved });
  }

  return drops;
}
