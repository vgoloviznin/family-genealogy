import { describe, expect, it } from 'vitest';
import { setAppLocale } from '@main/i18n';
import { zipError } from '@main/utils/zip-errors';
import { localizedErrorMessage } from '../../helpers/localized-error';

describe('zipError', () => {
  it('returns localized messages', () => {
    setAppLocale('ru');
    expect(zipError('errors.unsafeZipEntry', { path: '../evil.txt' }).message).toBe(
      localizedErrorMessage('errors.unsafeZipEntry', { path: '../evil.txt' })
    );

    setAppLocale('en');
    expect(zipError('errors.zipOpenFailed').message).toBe(localizedErrorMessage('errors.zipOpenFailed', undefined, 'en'));
    setAppLocale('ru');
  });
});
