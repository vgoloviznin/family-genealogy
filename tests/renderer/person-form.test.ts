import { describe, expect, it } from 'vitest';
import { buildFormFromPerson, isPersonFormDirty } from '@renderer/components/person-detail/helpers';
import type { PersonDetail } from '@shared/types';

function basePerson(overrides: Partial<PersonDetail> = {}): PersonDetail {
  return {
    id: 'p1',
    firstName: 'Ivan',
    lastName: 'Ivanov',
    sex: 'male',
    isLiving: true,
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2020-01-01T00:00:00.000Z',
    families: [],
    associations: [],
    events: [],
    media: [],
    citations: [],
    ...overrides
  };
}

describe('isPersonFormDirty', () => {
  it('is false for identical forms', () => {
    const form = buildFormFromPerson(basePerson());
    expect(isPersonFormDirty(form, form)).toBe(false);
  });

  it('detects field changes without JSON.stringify', () => {
    const a = buildFormFromPerson(basePerson());
    const b = { ...a, firstName: 'Petr' };
    expect(isPersonFormDirty(a, b)).toBe(true);
  });

  it('compares partial dates field-wise', () => {
    const a = buildFormFromPerson(basePerson());
    const b = {
      ...a,
      birthDate: { ...a.birthDate, year: 1900, precision: 'year' as const }
    };
    expect(isPersonFormDirty(a, b)).toBe(true);
  });
});
