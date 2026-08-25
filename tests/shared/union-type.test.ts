import { describe, expect, it } from 'vitest';
import { normalizeUnionType, UNION_TYPE_LABELS } from '@shared/union-type';

describe('normalizeUnionType', () => {
  it('keeps known union types', () => {
    expect(normalizeUnionType('marriage')).toBe('marriage');
    expect(normalizeUnionType('partnership')).toBe('partnership');
  });

  it('falls back to unknown for empty or invalid values', () => {
    expect(normalizeUnionType(null)).toBe('unknown');
    expect(normalizeUnionType('')).toBe('unknown');
    expect(normalizeUnionType('invalid')).toBe('unknown');
  });
});

describe('UNION_TYPE_LABELS', () => {
  it('includes a clear option', () => {
    expect(UNION_TYPE_LABELS.unknown).toBe('Не указан');
  });
});
