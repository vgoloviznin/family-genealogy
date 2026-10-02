import { describe, expect, it } from 'vitest';
import { planFamilyCollapse } from '@shared/merge-families';
import type { MergeRowRecord } from '@shared/merge-types';

function family(id: string, createdAt: string): MergeRowRecord {
  return { id, created_at: createdAt, deleted_at: null };
}

function partner(familyId: string, personId: string): MergeRowRecord {
  return { id: `${familyId}-${personId}`, family_id: familyId, person_id: personId, deleted_at: null };
}

function child(familyId: string, personId: string): MergeRowRecord {
  return { id: `${familyId}-c-${personId}`, family_id: familyId, person_id: personId, deleted_at: null };
}

describe('planFamilyCollapse', () => {
  it('keeps the older copy of an identical union', () => {
    const drops = planFamilyCollapse({
      families: [family('old', '2020-01-01T00:00:00.000Z'), family('new', '2024-01-01T00:00:00.000Z')],
      partners: [partner('old', 'mom'), partner('old', 'dad'), partner('new', 'mom'), partner('new', 'dad')],
      children: [child('old', 'kid'), child('new', 'kid')]
    });
    expect(drops).toEqual([{ familyId: 'new', keeperId: 'old' }]);
  });

  it('drops a parentless sibling group already stored under parents', () => {
    const drops = planFamilyCollapse({
      families: [family('marriage', '2020-01-01T00:00:00.000Z'), family('loose', '2024-01-01T00:00:00.000Z')],
      partners: [partner('marriage', 'mom'), partner('marriage', 'dad')],
      children: [child('marriage', 'a'), child('marriage', 'b'), child('loose', 'a'), child('loose', 'b')]
    });
    expect(drops).toEqual([{ familyId: 'loose', keeperId: 'marriage' }]);
  });

  it('drops a one-parent slice of a larger union', () => {
    const drops = planFamilyCollapse({
      families: [family('both', '2020-01-01T00:00:00.000Z'), family('mom-only', '2024-01-01T00:00:00.000Z')],
      partners: [partner('both', 'mom'), partner('both', 'dad'), partner('mom-only', 'mom')],
      children: [child('both', 'kid'), child('mom-only', 'kid')]
    });
    expect(drops).toEqual([{ familyId: 'mom-only', keeperId: 'both' }]);
  });

  it('keeps a second marriage and a real sibling group without parents', () => {
    const drops = planFamilyCollapse({
      families: [
        family('first', '2020-01-01T00:00:00.000Z'),
        family('second', '2021-01-01T00:00:00.000Z'),
        family('brothers', '2022-01-01T00:00:00.000Z')
      ],
      partners: [partner('first', 'mom'), partner('first', 'dad1'), partner('second', 'mom'), partner('second', 'dad2')],
      children: [child('first', 'kid1'), child('second', 'kid2'), child('brothers', 'kid1'), child('brothers', 'uncle')]
    });
    expect(drops).toEqual([]);
  });

  it('keeps a childless union that shares one spouse with a larger family', () => {
    const drops = planFamilyCollapse({
      families: [family('marriage', '2020-01-01T00:00:00.000Z'), family('started', '2024-01-01T00:00:00.000Z')],
      partners: [partner('marriage', 'mom'), partner('marriage', 'dad'), partner('started', 'mom')],
      children: [child('marriage', 'kid')]
    });
    expect(drops).toEqual([]);
  });
});
