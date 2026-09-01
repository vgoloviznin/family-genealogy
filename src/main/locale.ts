import type { AppLocale } from '@shared/types';
import { validateLocale } from '@shared/locales';
import { setAppLocale } from './i18n';
import { buildMenu } from './menu';

export function applyAppLocale(locale: AppLocale): AppLocale {
  const valid = validateLocale(locale);
  setAppLocale(valid);
  buildMenu(valid);
  return valid;
}
