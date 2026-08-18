import { describe, expect, it } from 'vitest'
import { formatCoordinates, mapLink, parseCoordinates } from './coordinates'

describe('parseCoordinates', () => {
  it('parses comma-separated values', () => {
    expect(parseCoordinates('55.7558, 37.6173')).toEqual({ latitude: 55.7558, longitude: 37.6173 })
  })

  it('parses space-separated values', () => {
    expect(parseCoordinates('55.7558 37.6173')).toEqual({ latitude: 55.7558, longitude: 37.6173 })
  })

  it('returns null for empty text', () => {
    expect(parseCoordinates('')).toBeNull()
    expect(parseCoordinates('   ')).toBeNull()
  })

  it('rejects out-of-range values', () => {
    expect(parseCoordinates('91, 0')).toBeNull()
    expect(parseCoordinates('0, 181')).toBeNull()
  })
})

describe('formatCoordinates', () => {
  it('formats a pair', () => {
    expect(formatCoordinates(55.7558, 37.6173)).toBe('55.7558, 37.6173')
  })

  it('returns empty string when incomplete', () => {
    expect(formatCoordinates(55.7558, null)).toBe('')
    expect(formatCoordinates(undefined, 37)).toBe('')
  })
})

describe('mapLink', () => {
  it('builds a Yandex Maps URL', () => {
    expect(mapLink({ latitude: 55.75, longitude: 37.62 })).toBe(
      'https://yandex.ru/maps/?pt=37.62,55.75&z=17&l=map'
    )
  })
})
