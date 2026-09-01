import type { DatePrecision, PartialDate } from '@shared/types';
import { formatPartialDate as formatPartialDateForLocale } from '@shared/format-partial-date';
import { getAppLocale } from '../i18n';

export function computeSortKey(date: PartialDate): number | null {
  const { year, month, day, precision } = date;
  if (precision === 'unknown' || year == null) {
    return null;
  }
  const m = month ?? 6;
  const d = day ?? 15;
  return year * 10000 + m * 100 + d;
}

export function normalizePartialDate(input: PartialDate): PartialDate {
  return {
    ...input,
    sortKey: computeSortKey(input)
  };
}

export function formatPartialDate(date: PartialDate): string {
  return formatPartialDateForLocale(date, getAppLocale());
}

export const defaultDate = (): PartialDate => ({
  precision: 'unknown' as DatePrecision,
  year: null,
  month: null,
  day: null,
  hour: null,
  minute: null,
  originalText: null,
  sortKey: null
});
