import { describe, expect, it } from 'vitest'
import {
  assignLayoutGenerations,
  buildFamilyConnectors,
  familyConnectorPath,
  layoutPedigreeTree,
  partnerLineCoords,
  standalonePartnerPairs,
  PEDIGREE_NODE_H,
  type TreeFamily
} from './tree-layout'

const golovizninFamily: TreeFamily = {
  id: 'f-gol',
  partners: ['nella', 'alexander'],
  children: ['vsevolod']
}

const valfreFamily: TreeFamily = {
  id: 'f-val',
  partners: ['davide'],
  children: ['diana', 'sabina']
}

describe('assignLayoutGenerations', () => {
  it('places children one row below parents', () => {
    const gens = assignLayoutGenerations(
      ['p1', 'p2', 'c1'],
      [
        ['p1', 'c1'],
        ['p2', 'c1']
      ],
      [['p1', 'p2']],
      'c1'
    )

    expect(gens.get('p1')).toBe(-1)
    expect(gens.get('p2')).toBe(-1)
    expect(gens.get('c1')).toBe(0)
  })
})

describe('layoutPedigreeTree', () => {
  it('centers parents above their children', () => {
    const positions = layoutPedigreeTree({
      nodeIds: ['p1', 'p2', 'c1', 'c2'],
      families: [{ id: 'f1', partners: ['p1', 'p2'], children: ['c1', 'c2'] }],
      partnerPairs: [['p1', 'p2']]
    })

    expect(positions.get('p1')!.y).toBeLessThan(positions.get('c1')!.y)
    expect(positions.get('c1')!.y).toBe(positions.get('c2')!.y)
    const parentsCenter = (positions.get('p1')!.x + positions.get('p2')!.x) / 2
    const childrenCenter = (positions.get('c1')!.x + positions.get('c2')!.x) / 2
    expect(Math.abs(parentsCenter - childrenCenter)).toBeLessThan(30)
  })

  it('lays out two family columns like the screenshot case', () => {
    const positions = layoutPedigreeTree({
      nodeIds: ['nella', 'alexander', 'vsevolod', 'davide', 'diana', 'sabina'],
      focusId: 'vsevolod',
      families: [golovizninFamily, valfreFamily],
      partnerPairs: [['nella', 'alexander'], ['vsevolod', 'diana']]
    })

    expect(positions.get('nella')!.y).toBeLessThan(positions.get('vsevolod')!.y)
    expect(positions.get('davide')!.y).toBeLessThan(positions.get('sabina')!.y)
    expect(positions.get('vsevolod')!.y).toBe(positions.get('diana')!.y)
    expect(positions.get('diana')!.y).toBe(positions.get('sabina')!.y)
    expect(positions.get('vsevolod')!.x).toBeLessThan(positions.get('diana')!.x)
    expect(positions.get('sabina')!.x).toBeGreaterThan(positions.get('diana')!.x)
    expect(positions.get('nella')!.x).toBeLessThan(positions.get('davide')!.x)
  })

  it('keeps child order from the family record', () => {
    const positions = layoutPedigreeTree({
      nodeIds: ['p1', 'zeta', 'alpha'],
      families: [{ id: 'f1', partners: ['p1'], children: ['zeta', 'alpha'] }],
      partnerPairs: []
    })

    expect(positions.get('zeta')!.x).toBeLessThan(positions.get('alpha')!.x)
  })

  it('builds a pedigree fork from parents to the child', () => {
    const families: TreeFamily[] = [{ id: 'f1', partners: ['p1', 'p2'], children: ['c1'] }]
    const positions = layoutPedigreeTree({
      nodeIds: ['p1', 'p2', 'c1'],
      families,
      partnerPairs: [['p1', 'p2']]
    })

    const connectors = buildFamilyConnectors(families, positions)
    expect(connectors).toHaveLength(1)
    expect(connectors[0].unionY).toBeGreaterThan(positions.get('p1')!.y)
    expect(connectors[0].unionY).toBeLessThan(positions.get('c1')!.y)
    expect(Math.abs(connectors[0].unionX - positions.get('c1')!.x)).toBeLessThan(30)

    const path = familyConnectorPath(connectors[0])
    expect(path).toContain(`L ${positions.get('c1')!.x} ${positions.get('c1')!.y}`)
  })

  it('does not draw a second partner line when the couple already has a marriage bar', () => {
    const pairs = standalonePartnerPairs(
      [
        ['nella', 'alexander'],
        ['vsevolod', 'diana']
      ],
      [golovizninFamily, valfreFamily]
    )
    expect(pairs).toEqual([['vsevolod', 'diana']])
  })

  it('uses fixed vertical spacing between generations', () => {
    const positions = layoutPedigreeTree({
      nodeIds: ['p1', 'c1', 'gc1'],
      families: [
        { id: 'f1', partners: ['p1'], children: ['c1'] },
        { id: 'f2', partners: ['c1'], children: ['gc1'] }
      ],
      partnerPairs: []
    })

    expect(positions.get('gc1')!.y - positions.get('c1')!.y).toBe(PEDIGREE_NODE_H)
    expect(positions.get('c1')!.y - positions.get('p1')!.y).toBe(PEDIGREE_NODE_H)
  })

  it('lays out three siblings in birth order under one parent', () => {
    const positions = layoutPedigreeTree({
      nodeIds: ['p1', 'c1', 'c2', 'c3'],
      families: [{ id: 'f1', partners: ['p1'], children: ['c1', 'c2', 'c3'] }],
      partnerPairs: []
    })

    expect(positions.get('c1')!.x).toBeLessThan(positions.get('c2')!.x)
    expect(positions.get('c2')!.x).toBeLessThan(positions.get('c3')!.x)
    expect(positions.get('p1')!.y).toBeLessThan(positions.get('c2')!.y)
  })

  it('draws partner line coords between spouse cards', () => {
    const left = { x: 0, y: 150 }
    const right = { x: 300, y: 150 }
    const line = partnerLineCoords(left, right)
    expect(line.x1).toBeLessThan(line.x2)
    expect(line.y1).toBe(line.y2)
  })
})
