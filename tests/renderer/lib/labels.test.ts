import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@renderer/i18n';
import { formatDate, formatLifeSpan, deceasedLabel, personLabel, siblingLabel, spouseLabel, eventTypeLabel } from '@renderer/lib/labels';

beforeEach(async () => {
  await i18n.changeLanguage('ru');
});

describe('personLabel', () => {
  it('joins name parts in Russian order', () => {
    expect(
      personLabel({
        lastName: 'Иванов',
        firstName: 'Иван',
        middleName: 'Петрович'
      })
    ).toBe('Иванов Иван Петрович');
  });

  it('returns fallback for empty name', () => {
    expect(personLabel({ lastName: '', firstName: '' })).toBe('Новый человек');
  });
});

describe('formatLifeSpan', () => {
  it('shows birth and death years', () => {
    expect(formatLifeSpan({ isLiving: false, birthYear: 1920, deathYear: 1998 })).toBe('1920–1998');
  });

  it('shows living person with birth year', () => {
    expect(formatLifeSpan({ isLiving: true, birthYear: 1945 })).toBe('р. 1945');
  });

  it('shows living without dates', () => {
    expect(formatLifeSpan({ isLiving: true })).toBe('жив');
  });

  it('shows deceased label by sex when dates are unknown', () => {
    expect(formatLifeSpan({ isLiving: false, sex: 'male' })).toBe('умер');
    expect(formatLifeSpan({ isLiving: false, sex: 'female' })).toBe('умерла');
    expect(formatLifeSpan({ isLiving: false, sex: 'unknown' })).toBe('умер(ла)');
  });

  it('shows gender-specific deceased wording with partial dates', () => {
    expect(formatLifeSpan({ isLiving: false, birthYear: 1920, sex: 'male' })).toBe('р. 1920 – умер');
    expect(formatLifeSpan({ isLiving: false, birthYear: 1920, sex: 'female' })).toBe('р. 1920 – умерла');
    expect(formatLifeSpan({ isLiving: false, deathYear: 1998, sex: 'female' })).toBe('умерла, 1998');
  });
});

describe('deceasedLabel', () => {
  it('returns gender-specific wording', () => {
    expect(deceasedLabel('male')).toBe('умер');
    expect(deceasedLabel('female')).toBe('умерла');
    expect(deceasedLabel('unknown')).toBe('умер(ла)');
  });
});

describe('formatDate', () => {
  it('uses originalText when present', () => {
    expect(
      formatDate({
        precision: 'circa',
        year: 1890,
        originalText: 'конец XIX в.'
      })
    ).toBe('конец XIX в.');
  });

  it('formats year only', () => {
    expect(
      formatDate({
        precision: 'year',
        year: 1920
      })
    ).toBe('1920');
  });

  it('formats year and month without day', () => {
    expect(
      formatDate({
        precision: 'month',
        year: 1920,
        month: 3
      })
    ).toBe('03.1920');
  });
});

describe('spouseLabel', () => {
  it('uses spouse terms by sex', () => {
    expect(spouseLabel('male')).toBe('Супруг');
    expect(spouseLabel('female')).toBe('Супруга');
    expect(spouseLabel('unknown')).toBe('Супруг(а)');
  });
});

describe('siblingLabel', () => {
  it('uses sibling terms by sex', () => {
    expect(siblingLabel('male')).toBe('Брат');
    expect(siblingLabel('female')).toBe('Сестра');
    expect(siblingLabel()).toBe('Брат/сестра');
  });
});

describe('labels en locale', () => {
  it('translates event type labels', async () => {
    await i18n.changeLanguage('en');
    expect(eventTypeLabel('birth')).toBe('Birth');
    expect(personLabel({ lastName: '', firstName: '' })).toBe('New person');
    expect(formatLifeSpan({ isLiving: true, birthYear: 1945 })).toBe('b. 1945');
    expect(spouseLabel('female')).toBe('Wife');
    await i18n.changeLanguage('ru');
  });
});

describe('labels it locale', () => {
  it('translates key labels', async () => {
    await i18n.changeLanguage('it');
    expect(personLabel({ lastName: '', firstName: '' })).toBe('Nuova persona');
    expect(formatLifeSpan({ isLiving: true })).toBe('vivente');
    expect(siblingLabel('female')).toBe('Sorella');
    await i18n.changeLanguage('ru');
  });
});
