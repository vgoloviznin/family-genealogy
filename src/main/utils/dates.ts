import type { DatePrecision, PartialDate } from '@shared/types'

export function computeSortKey(date: PartialDate): number | null {
  const { year, month, day, precision } = date
  if (precision === 'unknown' || year == null) return null
  const m = month ?? 6
  const d = day ?? 15
  return year * 10000 + m * 100 + d
}

export function normalizePartialDate(input: PartialDate): PartialDate {
  return {
    ...input,
    sortKey: computeSortKey(input)
  }
}

export function formatPartialDate(date: PartialDate): string {
  if (date.originalText) return date.originalText
  const parts: string[] = []
  if (date.precision === 'circa') parts.push('ок.')
  if (date.precision === 'before') parts.push('до')
  if (date.precision === 'after') parts.push('после')
  if (date.day) parts.push(String(date.day).padStart(2, '0'))
  if (date.month) parts.push(String(date.month).padStart(2, '0'))
  if (date.year) parts.push(String(date.year))
  if (date.hour != null && date.minute != null) {
    parts.push(`${String(date.hour).padStart(2, '0')}:${String(date.minute).padStart(2, '0')}`)
  }
  return parts.join('.') || '—'
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
})
