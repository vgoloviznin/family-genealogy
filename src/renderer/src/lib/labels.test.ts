import { describe, expect, it } from 'vitest'
import { formatDate, formatLifeSpan, personLabel, siblingLabel, spouseLabel } from './labels'

describe('personLabel', () => {
  it('joins name parts in Russian order', () => {
    expect(
      personLabel({
        lastName: 'Иванов',
        firstName: 'Иван',
        middleName: 'Петрович'
      })
    ).toBe('Иванов Иван Петрович')
  })

  it('returns fallback for empty name', () => {
    expect(personLabel({ lastName: '', firstName: '' })).toBe('Новый человек')
  })
})

describe('formatLifeSpan', () => {
  it('shows birth and death years', () => {
    expect(formatLifeSpan({ isLiving: false, birthYear: 1920, deathYear: 1998 })).toBe('1920–1998')
  })

  it('shows living person with birth year', () => {
    expect(formatLifeSpan({ isLiving: true, birthYear: 1945 })).toBe('р. 1945')
  })

  it('shows living without dates', () => {
    expect(formatLifeSpan({ isLiving: true })).toBe('жив')
  })
})

describe('formatDate', () => {
  it('uses originalText when present', () => {
    expect(
      formatDate({
        precision: 'circa',
        year: 1890,
        originalText: 'конец XIX в.'
      })
    ).toBe('конец XIX в.')
  })
})

describe('spouseLabel', () => {
  it('uses spouse terms by sex', () => {
    expect(spouseLabel('male')).toBe('Супруг')
    expect(spouseLabel('female')).toBe('Супруга')
    expect(spouseLabel('unknown')).toBe('Супруг(а)')
  })
})

describe('siblingLabel', () => {
  it('uses sibling terms by sex', () => {
    expect(siblingLabel('male')).toBe('Брат')
    expect(siblingLabel('female')).toBe('Сестра')
    expect(siblingLabel()).toBe('Брат/сестра')
  })
})
