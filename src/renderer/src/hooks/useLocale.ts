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

export function useLocale() {
  const [ready, setReady] = useState(false);
  const [locale, setLocaleState] = useState<AppLocale>(DEFAULT_LOCALE);

  useEffect(() => {
    let cancelled = false;
    void window.api.settings.get().then(async (settings) => {
      const next = validateLocale(settings.locale);
      await i18n.changeLanguage(next);
      if (cancelled) {
        return;
      }
      applyDocumentLocale(next);
      syncDocumentTitle();
      setLocaleState(next);
      setReady(true);
    });
    return () => {
      cancelled = true;
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
