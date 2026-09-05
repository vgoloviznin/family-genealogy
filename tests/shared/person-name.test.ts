import { describe, expect, it } from 'vitest';
import { hasRequiredNamePart } from '@shared/person-name';

describe('hasRequiredNamePart', () => {
  it('is true when first name is set', () => {
    expect(hasRequiredNamePart('Ivan', '')).toBe(true);
  });

  it('is true when last name is set', () => {
    expect(hasRequiredNamePart('', 'Ivanov')).toBe(true);
  });

  it('is false when both are empty or whitespace', () => {
    expect(hasRequiredNamePart('', '')).toBe(false);
    expect(hasRequiredNamePart('  ', '  ')).toBe(false);
    expect(hasRequiredNamePart(null, undefined)).toBe(false);
  });
});
