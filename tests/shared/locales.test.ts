import { describe, expect, it } from 'vitest';
import { flattenKeys, localeResources, SUPPORTED_LOCALES, translate, validateLocale } from '@shared/locales';

describe('locales', () => {
  it('has the same keys in every supported locale', () => {
    const reference = new Set(flattenKeys(localeResources.ru as Record<string, unknown>));
    for (const locale of SUPPORTED_LOCALES) {
      const keys = new Set(flattenKeys(localeResources[locale] as Record<string, unknown>));
      expect(keys).toEqual(reference);
    }
  });

  it('translates known keys', () => {
    expect(translate('ru', 'save')).toBe('Сохранить');
    expect(translate('en', 'save')).toBe('Save');
    expect(translate('it', 'save')).toBe('Salva');
  });

  it('interpolates params', () => {
    expect(translate('en', 'deletePersonConfirm', { name: 'John' })).toBe('Delete John?');
  });

  it('validateLocale falls back to default', () => {
    expect(validateLocale('fr')).toBe('ru');
    expect(validateLocale(undefined)).toBe('ru');
  });

  it('translates pack manifest error keys', () => {
    expect(translate('ru', 'errors.invalidArchiveFormat')).toBe('Неверный формат архива');
    expect(translate('en', 'errors.dbHashMismatch')).toBe('Database checksum does not match');
  });

  it('translates error keys in en and it', () => {
    expect(translate('en', 'errors.wrongProjectArchive')).toBe('Archive belongs to another project');
    expect(translate('it', 'errors.unsafeZipEntry', { path: 'evil' })).toContain('evil');
  });
});
