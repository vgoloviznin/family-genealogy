import type { AppLocale } from '@shared/types';
import { translate } from '@shared/locales';

export { translate as t };

export function localizedError(key: string, params?: Record<string, string | number>): string {
  return translate(getAppLocale(), key, params);
}

let currentLocale: AppLocale = 'ru';

export function setAppLocale(locale: AppLocale): void {
  currentLocale = locale;
}

export function getAppLocale(): AppLocale {
  return currentLocale;
}

export function initAppLocale(locale: AppLocale): void {
  currentLocale = locale;
}
