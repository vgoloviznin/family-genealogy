import { describe, expect, it } from 'vitest'
import { computeSortKey, defaultDate, formatPartialDate, normalizePartialDate } from './dates'

describe('computeSortKey', () => {
  it('returns null for unknown precision without year', () => {
    expect(computeSortKey({ precision: 'unknown', year: null })).toBeNull()
  })

  it('builds sort key from year with default month/day', () => {
    expect(computeSortKey({ precision: 'year', year: 1945 })).toBe(19450615)
  })

  it('builds sort key from exact date', () => {
    expect(
      computeSortKey({
        precision: 'exact',
        year: 1990,
        month: 3,
        day: 7
      })
    ).toBe(19900307)
  })
})

describe('normalizePartialDate', () => {
  it('fills sortKey', () => {
    const result = normalizePartialDate({ precision: 'year', year: 1920 })
    expect(result.sortKey).toBe(19200615)
  })
})

describe('formatPartialDate', () => {
  it('prefers originalText', () => {
    expect(
      formatPartialDate({
        precision: 'circa',
        year: 1890,
        originalText: 'ок. 1890-е'
      })
    ).toBe('ок. 1890-е')
  })

  it('formats exact date parts', () => {
    expect(
      formatPartialDate({
        precision: 'exact',
        year: 2001,
        month: 5,
        day: 9
      })
    ).toBe('09.05.2001')
  })

  it('returns em dash when empty', () => {
    expect(formatPartialDate(defaultDate())).toBe('—')
  })
})
