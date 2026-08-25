import type { UnionType } from './types';

export const UNION_TYPE_LABELS: Record<UnionType, string> = {
  unknown: 'Не указан',
  marriage: 'Брак',
  partnership: 'Союз'
};

export function normalizeUnionType(value: string | null | undefined): UnionType {
  if (value === 'marriage' || value === 'partnership') {
    return value;
  }
  return 'unknown';
}
