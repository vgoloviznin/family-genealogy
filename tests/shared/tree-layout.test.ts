import { describe, expect, it } from 'vitest';
import {
  assignLayoutGenerations,
  buildFamilyConnectors,
  compactNameLines,
  estimatePedigreeCardWidth,
  familyConnectorPath,
  familyConnectorSegments,
  layoutPedigreeTree,
  partnerLineCoords,
  standalonePartnerPairs,
  TREE_LINE_STYLES,
  PEDIGREE_CARD_H,
  PEDIGREE_NODE_H,
  PEDIGREE_NODE_MIN_W,
  PEDIGREE_ROW_GAP,
  PEDIGREE_SIBLING_GAP,
  type TreeFamily
} from '@shared/tree-layout';

const golovizninFamily: TreeFamily = {
  id: 'f-gol',
  partners: ['nella', 'alexander'],
  children: ['vsevolod']
};

const valfreFamily: TreeFamily = {
  id: 'f-val',
  partners: ['davide'],
  children: ['diana', 'sabina']
};

describe('estimatePedigreeCardWidth', () => {
  it('uses minimum width for short names', () => {
    const width = estimatePedigreeCardWidth(compactNameLines({ firstName: 'Иван', lastName: 'И.', middleName: null }));
    expect(width).toBe(PEDIGREE_NODE_MIN_W);
  });

  it('widens cards for long given names', () => {
    const width = estimatePedigreeCardWidth(compactNameLines({ firstName: 'Всеволод', lastName: 'Головизнин', middleName: 'Александрович' }));
    expect(width).toBeGreaterThan(PEDIGREE_NODE_MIN_W);
  });

  it('accounts for English name line width', () => {
    const withoutEn = estimatePedigreeCardWidth(compactNameLines({ firstName: 'И.', lastName: 'И.', firstNameEn: '', lastNameEn: '' }));
    const withEn = estimatePedigreeCardWidth(
      compactNameLines({
        firstName: 'И.',
        lastName: 'И.',
        firstNameEn: 'Vsevolod',
        lastNameEn: 'Goloviznin',
        middleNameEn: 'Alexandrovich'
      })
    );
    expect(withEn).toBeGreaterThan(withoutEn);
  });

  it('exposes english line from compactNameLines', () => {
    const lines = compactNameLines({
      firstName: 'Иван',
      lastName: 'Иванов',
      firstNameEn: 'Ivan',
      lastNameEn: 'Ivanov'
    });
    expect(lines.english).toBe('Ivanov Ivan');
  });
});

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
    );

    expect(gens.get('p1')).toBe(-1);
    expect(gens.get('p2')).toBe(-1);
    expect(gens.get('c1')).toBe(0);
  });

  it('still stacks parents above children without a focus person', () => {
    const gens = assignLayoutGenerations(['c1', 'p1'], [['p1', 'c1']], []);
    expect(gens.get('p1')!).toBeLessThan(gens.get('c1')!);
  });

  it('aligns partners to the deeper generation when one spouse has parents', () => {
    // Unrelated focus leaves the branch at gen 0 (same as a disconnected component).
    // Old MIN equalization oscillated forever (son pushed to 1, then pulled back to spouse's 0).
    const gens = assignLayoutGenerations(
      ['outsider', 'father', 'son', 'spouse'],
      [['father', 'son']],
      [['son', 'spouse']],
      'outsider'
    );

    expect(gens.get('father')).toBe(0);
    expect(gens.get('son')).toBe(1);
    expect(gens.get('spouse')).toBe(1);
  });

  it('terminates when a parent/partner cycle makes constraints unsatisfiable', () => {
    const started = Date.now();
    const gens = assignLayoutGenerations(['a', 'b'], [['a', 'b']], [['a', 'b']], 'a');
    expect(Date.now() - started).toBeLessThan(1000);
    expect(gens.size).toBe(2);
  });
});

describe('layoutPedigreeTree hang regression', () => {
  it('finishes for spouses with uneven parental depth (Sadomtsev/Golikov shape)', () => {
    const families: TreeFamily[] = [
      { id: 'f-gf', partners: ['vasily-f'], children: ['vasily-v'] },
      { id: 'f-g', partners: ['vasily-v', 'maria'], children: ['lyubov', 'alexey'] },
      { id: 'f-s', partners: ['lyubov', 'yuri'], children: [] },
      { id: 'f-orphan', partners: [], children: ['yuri', 'vladimir'] }
    ];
    const nodeIds = ['vasily-f', 'vasily-v', 'maria', 'lyubov', 'alexey', 'yuri', 'vladimir'];
    const started = Date.now();
    const positions = layoutPedigreeTree({
      nodeIds,
      focusId: 'vasily-f',
      families,
      partnerPairs: [
        ['vasily-v', 'maria'],
        ['lyubov', 'yuri']
      ]
    });
    expect(Date.now() - started).toBeLessThan(1000);
    expect(positions.size).toBe(nodeIds.length);
    expect(positions.get('vasily-v')!.y).toBe(positions.get('maria')!.y);
    expect(positions.get('lyubov')!.y).toBe(positions.get('yuri')!.y);
    expect(positions.get('lyubov')!.y).toBeGreaterThan(positions.get('vasily-v')!.y);
  });
});

describe('layoutPedigreeTree', () => {
  it('centers parents above their children', () => {
    const positions = layoutPedigreeTree({
      nodeIds: ['p1', 'p2', 'c1', 'c2'],
      families: [{ id: 'f1', partners: ['p1', 'p2'], children: ['c1', 'c2'] }],
      partnerPairs: [['p1', 'p2']]
    });

    expect(positions.get('p1')!.y).toBeLessThan(positions.get('c1')!.y);
    expect(positions.get('c1')!.y).toBe(positions.get('c2')!.y);
    const parentsCenter = (positions.get('p1')!.x + positions.get('p2')!.x) / 2;
    const childrenCenter = (positions.get('c1')!.x + positions.get('c2')!.x) / 2;
    expect(Math.abs(parentsCenter - childrenCenter)).toBeLessThan(30);
  });

  it('lays out two family columns like the screenshot case', () => {
    const positions = layoutPedigreeTree({
      nodeIds: ['nella', 'alexander', 'vsevolod', 'davide', 'diana', 'sabina'],
      focusId: 'vsevolod',
      families: [golovizninFamily, valfreFamily],
      partnerPairs: [
        ['nella', 'alexander'],
        ['vsevolod', 'diana']
      ]
    });

    expect(positions.get('nella')!.y).toBeLessThan(positions.get('vsevolod')!.y);
    expect(positions.get('davide')!.y).toBeLessThan(positions.get('sabina')!.y);
    expect(positions.get('vsevolod')!.y).toBe(positions.get('diana')!.y);
    expect(positions.get('diana')!.y).toBe(positions.get('sabina')!.y);
    expect(positions.get('vsevolod')!.x).toBeLessThan(positions.get('diana')!.x);
    expect(positions.get('sabina')!.x).toBeGreaterThan(positions.get('diana')!.x);
    expect(Math.abs(positions.get('vsevolod')!.x - positions.get('diana')!.x)).toBeLessThan(360);
    expect(Math.abs(positions.get('davide')!.x - positions.get('diana')!.x)).toBeLessThan(360);
    const treeWidth = Math.max(...[...positions.values()].map((p) => p.x)) - Math.min(...[...positions.values()].map((p) => p.x));
    expect(treeWidth).toBeLessThan(900);
  });

  it('keeps child order from the family record', () => {
    const positions = layoutPedigreeTree({
      nodeIds: ['p1', 'zeta', 'alpha'],
      families: [{ id: 'f1', partners: ['p1'], children: ['zeta', 'alpha'] }],
      partnerPairs: []
    });

    expect(positions.get('zeta')!.x).toBeLessThan(positions.get('alpha')!.x);
  });

  it('builds a pedigree fork from parents to the child', () => {
    const families: TreeFamily[] = [{ id: 'f1', partners: ['p1', 'p2'], children: ['c1'] }];
    const positions = layoutPedigreeTree({
      nodeIds: ['p1', 'p2', 'c1'],
      families,
      partnerPairs: [['p1', 'p2']]
    });

    const connectors = buildFamilyConnectors(families, positions);
    expect(connectors).toHaveLength(1);
    expect(connectors[0].unionY).toBeGreaterThan(positions.get('p1')!.y);
    expect(connectors[0].unionY).toBeLessThanOrEqual(connectors[0].childBarY);
    expect(connectors[0].childBarY).toBeLessThanOrEqual(positions.get('c1')!.y);
    expect(Math.abs(connectors[0].unionX - positions.get('c1')!.x)).toBeLessThan(30);

    const segments = familyConnectorSegments(connectors[0]);
    expect(segments.some((s) => s.kind === 'partner')).toBe(true);
    expect(segments.some((s) => s.kind === 'parent' || s.kind === 'child')).toBe(true);
    expect(segments.some((s) => s.kind === 'child' && s.y2 === positions.get('c1')!.y)).toBe(true);
    expect(segments.some((s) => s.kind === 'sibling')).toBe(false);

    const path = familyConnectorPath(connectors[0]);
    expect(path).toContain(`L ${positions.get('c1')!.x} ${positions.get('c1')!.y}`);
  });

  it('draws a black parent bar and a red sibling line for multiple children', () => {
    const families: TreeFamily[] = [{ id: 'f1', partners: ['p1', 'p2'], children: ['c1', 'c2'] }];
    const positions = layoutPedigreeTree({
      nodeIds: ['p1', 'p2', 'c1', 'c2'],
      families,
      partnerPairs: [['p1', 'p2']]
    });
    const segments = familyConnectorSegments(buildFamilyConnectors(families, positions)[0]);
    const parentBar = segments.find((s) => s.id === 'f1-child-bar');
    const sibling = segments.find((s) => s.kind === 'sibling');
    expect(parentBar?.kind).toBe('parent');
    expect(sibling).toBeTruthy();
    expect(sibling!.y1).toBe(positions.get('c1')!.y + PEDIGREE_CARD_H / 2);
    expect(sibling!.y1).not.toBe(parentBar!.y1);
  });

  it('does not draw a second partner line when the couple already has a marriage bar', () => {
    const pairs = standalonePartnerPairs(
      [
        ['nella', 'alexander'],
        ['vsevolod', 'diana']
      ],
      [golovizninFamily, valfreFamily]
    );
    expect(pairs).toEqual([['vsevolod', 'diana']]);
  });

  it('does not treat siblings as spouses', () => {
    const pairs = standalonePartnerPairs(
      [
        ['vsevolod', 'diana'],
        ['diana', 'sabina']
      ],
      [golovizninFamily, valfreFamily]
    );
    expect(pairs).toEqual([['vsevolod', 'diana']]);
  });

  it('uses dashed red for partners, solid red for siblings, solid black for parents', () => {
    expect(TREE_LINE_STYLES.partner.strokeDasharray).toBeTruthy();
    expect(TREE_LINE_STYLES.partner.stroke).toBe('#dc2626');
    expect(TREE_LINE_STYLES.sibling.strokeDasharray).toBeUndefined();
    expect(TREE_LINE_STYLES.sibling.stroke).toBe('#dc2626');
    expect(TREE_LINE_STYLES.parent.stroke).toBe('#171717');
    expect(TREE_LINE_STYLES.child.stroke).toBe('#171717');
    expect(TREE_LINE_STYLES.parent.strokeDasharray).toBeUndefined();
  });

  it('uses fixed vertical spacing between generations', () => {
    const positions = layoutPedigreeTree({
      nodeIds: ['p1', 'c1', 'gc1'],
      families: [
        { id: 'f1', partners: ['p1'], children: ['c1'] },
        { id: 'f2', partners: ['c1'], children: ['gc1'] }
      ],
      partnerPairs: []
    });

    expect(positions.get('gc1')!.y - positions.get('c1')!.y).toBe(PEDIGREE_NODE_H);
    expect(positions.get('c1')!.y - positions.get('p1')!.y).toBe(PEDIGREE_NODE_H);
  });

  it('lays out three siblings in birth order under one parent', () => {
    const positions = layoutPedigreeTree({
      nodeIds: ['p1', 'c1', 'c2', 'c3'],
      families: [{ id: 'f1', partners: ['p1'], children: ['c1', 'c2', 'c3'] }],
      partnerPairs: []
    });

    expect(positions.get('c1')!.x).toBeLessThan(positions.get('c2')!.x);
    expect(positions.get('c2')!.x).toBeLessThan(positions.get('c3')!.x);
    expect(positions.get('p1')!.y).toBeLessThan(positions.get('c2')!.y);
  });

  it('does not overlap wide cards in the screenshot case', () => {
    const nodeWidths = new Map([
      ['nella', 260],
      ['alexander', 280],
      ['vsevolod', 300],
      ['davide', 240],
      ['diana', 280],
      ['sabina', 260]
    ]);
    const positions = layoutPedigreeTree({
      nodeIds: ['nella', 'alexander', 'vsevolod', 'davide', 'diana', 'sabina'],
      focusId: 'vsevolod',
      families: [golovizninFamily, valfreFamily],
      partnerPairs: [
        ['nella', 'alexander'],
        ['vsevolod', 'diana']
      ],
      nodeWidths
    });
    const generations = assignLayoutGenerations(
      ['nella', 'alexander', 'vsevolod', 'davide', 'diana', 'sabina'],
      [
        ['nella', 'vsevolod'],
        ['alexander', 'vsevolod'],
        ['davide', 'diana'],
        ['davide', 'sabina']
      ],
      [
        ['nella', 'alexander'],
        ['vsevolod', 'diana']
      ],
      'vsevolod'
    );

    const byGen = new Map<number, string[]>();
    for (const id of nodeWidths.keys()) {
      const g = generations.get(id) ?? 0;
      if (!byGen.has(g)) {
        byGen.set(g, []);
      }
      byGen.get(g)!.push(id);
    }

    for (const ids of byGen.values()) {
      const sorted = [...ids].sort((a, b) => positions.get(a)!.x - positions.get(b)!.x);
      for (let i = 1; i < sorted.length; i++) {
        const a = sorted[i - 1];
        const b = sorted[i];
        const gap = positions.get(b)!.x - nodeWidths.get(b)! / 2 - (positions.get(a)!.x + nodeWidths.get(a)! / 2);
        expect(gap).toBeGreaterThanOrEqual(PEDIGREE_ROW_GAP - 1);
      }
    }
  });

  it('places in-law siblings next to the couple, not a family-width away', () => {
    const grandparents: TreeFamily = { id: 'f-gp', partners: ['svetlana', 'rafail'], children: ['alexander'] };
    const nodeWidths = new Map([
      ['svetlana', 260],
      ['rafail', 240],
      ['nella', 260],
      ['alexander', 280],
      ['vsevolod', 300],
      ['davide', 240],
      ['diana', 280],
      ['sabina', 260]
    ]);
    const positions = layoutPedigreeTree({
      nodeIds: ['svetlana', 'rafail', 'nella', 'alexander', 'vsevolod', 'davide', 'diana', 'sabina'],
      focusId: 'vsevolod',
      families: [grandparents, golovizninFamily, valfreFamily],
      partnerPairs: [
        ['svetlana', 'rafail'],
        ['nella', 'alexander'],
        ['vsevolod', 'diana']
      ],
      nodeWidths
    });

    const dianaRight = positions.get('diana')!.x + nodeWidths.get('diana')! / 2;
    const sabinaLeft = positions.get('sabina')!.x - nodeWidths.get('sabina')! / 2;
    expect(sabinaLeft - dianaRight).toBeGreaterThanOrEqual(PEDIGREE_ROW_GAP - 1);
    expect(sabinaLeft - dianaRight).toBeLessThan(PEDIGREE_SIBLING_GAP + 40);

    const vsevolodRight = positions.get('vsevolod')!.x + nodeWidths.get('vsevolod')! / 2;
    const dianaLeft = positions.get('diana')!.x - nodeWidths.get('diana')! / 2;
    expect(dianaLeft - vsevolodRight).toBeGreaterThanOrEqual(PEDIGREE_ROW_GAP - 1);
  });

  it('draws partner line coords between spouse cards', () => {
    const left = { x: 0, y: 150 };
    const right = { x: 300, y: 150 };
    const line = partnerLineCoords(left, right, 148, 148);
    expect(line.x1).toBeLessThan(line.x2);
    expect(line.y1).toBe(line.y2);
  });
});
