import type { AppLocale } from '@shared/types';

export function applyDocumentLocale(locale: AppLocale): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.lang = locale;
}
