import { describe, expect, it } from 'vitest';
import { assignGenerationsFromFocus, buildProjectGraph, defaultTreeFocusId } from '@shared/tree-graph';

describe('buildProjectGraph', () => {
  it('builds sibling pairs for three children', () => {
    const graph = buildProjectGraph(new Map([['f1', ['p1']]]), new Map([['f1', ['c1', 'c2', 'c3']]]));
    expect(graph.siblingPairs).toEqual(
      expect.arrayContaining([
        ['c1', 'c2'],
        ['c1', 'c3'],
        ['c2', 'c3']
      ])
    );
    expect(graph.siblingPairs).toHaveLength(3);
  });

  it('links child to each partner in a couple', () => {
    const partnersByFamily = new Map([
      ['f1', ['p1', 'p2']],
      ['f2', ['p3']]
    ]);
    const childrenByFamily = new Map([
      ['f1', ['c1', 'c2']],
      ['f2', ['c3']]
    ]);

    const graph = buildProjectGraph(partnersByFamily, childrenByFamily);

    expect(graph.partnerPairs).toEqual([['p1', 'p2']]);
    expect(graph.parentPairs).toEqual(
      expect.arrayContaining([
        ['p1', 'c1'],
        ['p1', 'c2'],
        ['p2', 'c1'],
        ['p2', 'c2'],
        ['p3', 'c3']
      ])
    );
    expect(graph.siblingPairs).toEqual([['c1', 'c2']]);
  });
});

describe('assignGenerationsFromFocus', () => {
  it('places spouse and sister-in-law on the same generation as focus', () => {
    const partnerPairs: Array<[string, string]> = [['focus', 'spouse']];
    const parentPairs: Array<[string, string]> = [
      ['parent1', 'spouse'],
      ['parent2', 'spouse'],
      ['parent1', 'sister'],
      ['parent2', 'sister']
    ];
    const gens = assignGenerationsFromFocus('focus', ['focus', 'spouse', 'sister', 'parent1', 'parent2'], partnerPairs, parentPairs);

    expect(gens.get('focus')).toBe(0);
    expect(gens.get('spouse')).toBe(0);
    expect(gens.get('sister')).toBe(0);
    expect(gens.get('parent1')).toBe(-1);
    expect(gens.get('parent2')).toBe(-1);
  });

  it('assigns generation 0 to people without family links', () => {
    const gens = assignGenerationsFromFocus('focus', ['focus', 'lonely'], [], []);
    expect(gens.get('lonely')).toBe(0);
  });
});

describe('defaultTreeFocusId', () => {
  it('returns null when there are no people', () => {
    expect(defaultTreeFocusId([], [])).toBeNull();
  });

  it('prefers a person who is not a child', () => {
    expect(defaultTreeFocusId(['c1', 'p1', 'c2'], ['c1', 'c2'])).toBe('p1');
  });

  it('falls back to the first person', () => {
    expect(defaultTreeFocusId(['a', 'b'], [])).toBe('a');
  });
});
