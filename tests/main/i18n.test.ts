import { describe, expect, it } from 'vitest';
import { getAppLocale, initAppLocale, localizedError, setAppLocale } from '@main/i18n';
import { applyAppLocale } from '@main/locale';
import { validateLocale } from '@shared/locales';

describe('main i18n', () => {
  it('defaults locale to ru', () => {
    initAppLocale('ru');
    expect(getAppLocale()).toBe('ru');
  });

  it('localizedError follows active locale', () => {
    setAppLocale('en');
    expect(localizedError('errors.personNotFound')).toBe('Person not found');
    setAppLocale('ru');
    expect(localizedError('errors.personNotFound')).toBe('Человек не найден');
  });

  it('applyAppLocale validates and sets locale', () => {
    expect(applyAppLocale('it')).toBe('it');
    expect(getAppLocale()).toBe('it');
    applyAppLocale('ru');
  });

  it('validateLocale falls back for invalid values', () => {
    expect(validateLocale('de')).toBe('ru');
    expect(validateLocale(null)).toBe('ru');
  });
});
