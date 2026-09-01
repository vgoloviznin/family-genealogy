import { translate, DEFAULT_LOCALE } from '@shared/locales';
import type { AppLocale } from '@shared/types';

/** Localized error message for tests and assertions (default locale: ru). */
export function localizedErrorMessage(key: string, params?: Record<string, string | number>, locale: AppLocale = DEFAULT_LOCALE): string {
  return translate(locale, key, params);
}
