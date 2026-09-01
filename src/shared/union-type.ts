import type { UnionType } from './types';

export function normalizeUnionType(value: string | null | undefined): UnionType {
  if (value === 'marriage' || value === 'partnership') {
    return value;
  }
  return 'unknown';
}
