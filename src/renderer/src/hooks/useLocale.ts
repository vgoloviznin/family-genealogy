import { useCallback, useEffect, useState } from 'react';
import type { AppLocale } from '@shared/types';
import { DEFAULT_LOCALE, validateLocale } from '@shared/locales';
import i18n from '../i18n';
import { applyDocumentLocale } from '../lib/document-locale';

function syncDocumentTitle(): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.title = i18n.t('appTitle');
}

function markLocaleReady(
  cancelled: boolean,
  setLocaleState: (locale: AppLocale) => void,
  setReady: (ready: boolean) => void,
  locale: AppLocale
): void {
  if (cancelled) {
    return;
  }
  applyDocumentLocale(locale);
  syncDocumentTitle();
  setLocaleState(locale);
  setReady(true);
}

export function useLocale() {
  const [ready, setReady] = useState(false);
  const [locale, setLocaleState] = useState<AppLocale>(DEFAULT_LOCALE);

  useEffect(() => {
    let cancelled = false;
    const failSafe = window.setTimeout(() => {
      markLocaleReady(cancelled, setLocaleState, setReady, DEFAULT_LOCALE);
    }, 4000);

    const api = typeof window !== 'undefined' ? window.api : undefined;
    if (!api?.settings?.get) {
      window.clearTimeout(failSafe);
      markLocaleReady(cancelled, setLocaleState, setReady, DEFAULT_LOCALE);
      return () => {
        cancelled = true;
      };
    }

    void api.settings
      .get()
      .then(async (settings) => {
        window.clearTimeout(failSafe);
        const next = validateLocale(settings.locale);
        await i18n.changeLanguage(next);
        markLocaleReady(cancelled, setLocaleState, setReady, next);
      })
      .catch(() => {
        window.clearTimeout(failSafe);
        markLocaleReady(cancelled, setLocaleState, setReady, DEFAULT_LOCALE);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(failSafe);
    };
  }, []);

  const setLocale = useCallback(async (next: AppLocale) => {
    const valid = validateLocale(next);
    await i18n.changeLanguage(valid);
    applyDocumentLocale(valid);
    syncDocumentTitle();
    setLocaleState(valid);
    return window.api.settings.set({ locale: valid });
  }, []);

  return { ready, locale, setLocale };
}
