export interface ProjectGraph {
  personIds: string[]
  partnerPairs: Array<[string, string]>
  parentPairs: Array<[string, string]>
  siblingPairs: Array<[string, string]>
}

/** Построить граф связей из всех семей проекта */
export function buildProjectGraph(
  partnersByFamily: Map<string, string[]>,
  childrenByFamily: Map<string, string[]>
): ProjectGraph {
  const partnerSet = new Set<string>()
  const partnerPairs: Array<[string, string]> = []
  const parentSet = new Set<string>()
  const parentPairs: Array<[string, string]> = []
  const siblingSet = new Set<string>()
  const siblingPairs: Array<[string, string]> = []
  const personIds = new Set<string>()

  for (const partners of partnersByFamily.values()) {
    for (const id of partners) personIds.add(id)
    for (let i = 0; i < partners.length; i++) {
      for (let j = i + 1; j < partners.length; j++) {
        const key = [partners[i], partners[j]].sort().join('<->')
        if (!partnerSet.has(key)) {
          partnerSet.add(key)
          partnerPairs.push([partners[i], partners[j]])
        }
      }
    }
  }

  for (const [familyId, children] of childrenByFamily.entries()) {
    const parents = partnersByFamily.get(familyId) ?? []
    for (const id of children) personIds.add(id)
    for (const parent of parents) {
      personIds.add(parent)
      for (const child of children) {
        const key = `${parent}->${child}`
        if (!parentSet.has(key)) {
          parentSet.add(key)
          parentPairs.push([parent, child])
        }
      }
    }
    for (let i = 0; i < children.length; i++) {
      for (let j = i + 1; j < children.length; j++) {
        const key = [children[i], children[j]].sort().join('~')
        if (!siblingSet.has(key)) {
          siblingSet.add(key)
          siblingPairs.push([children[i], children[j]])
        }
      }
    }
  }

  return {
    personIds: [...personIds],
    partnerPairs,
    parentPairs,
    siblingPairs
  }
}

/** Назначить поколения от выбранного человека по всем рёбрам графа */
export function assignGenerationsFromFocus(
  focusId: string,
  allPersonIds: string[],
  partnerPairs: Array<[string, string]>,
  parentPairs: Array<[string, string]>
): Map<string, number> {
  const partners = new Map<string, Set<string>>()
  const children = new Map<string, Set<string>>()
  const parents = new Map<string, Set<string>>()

  const link = (map: Map<string, Set<string>>, a: string, b: string) => {
    if (!map.has(a)) map.set(a, new Set())
    map.get(a)!.add(b)
  }

  for (const [a, b] of partnerPairs) {
    link(partners, a, b)
    link(partners, b, a)
  }
  for (const [parent, child] of parentPairs) {
    link(children, parent, child)
    link(parents, child, parent)
  }

  const gen = new Map<string, number>()
  const queue: string[] = []

  if (allPersonIds.includes(focusId)) {
    gen.set(focusId, 0)
    queue.push(focusId)
  }

  while (queue.length > 0) {
    const id = queue.shift()!
    const g = gen.get(id)!

    for (const pid of partners.get(id) ?? []) {
      if (!gen.has(pid)) {
        gen.set(pid, g)
        queue.push(pid)
      }
    }
    for (const cid of children.get(id) ?? []) {
      if (!gen.has(cid)) {
        gen.set(cid, g + 1)
        queue.push(cid)
      }
    }
    for (const pid of parents.get(id) ?? []) {
      if (!gen.has(pid)) {
        gen.set(pid, g - 1)
        queue.push(pid)
      }
    }
  }

  for (const id of allPersonIds) {
    if (!gen.has(id)) gen.set(id, 0)
  }

  return gen
}
