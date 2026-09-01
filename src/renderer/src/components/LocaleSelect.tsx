import { useTranslation } from 'react-i18next';
import type { AppLocale } from '@shared/types';
import { LOCALE_META, SUPPORTED_LOCALES } from '@shared/locales';

export function LocaleSelect({ value, onChange, compact = false }: { value: AppLocale; onChange: (locale: AppLocale) => void; compact?: boolean }) {
  const { t } = useTranslation();

  if (compact) {
    return (
      <label className="text-sm flex items-center gap-2">
        <span className="text-stone-600 shrink-0">{t('language')}</span>
        <select className="border rounded px-2 py-1 text-sm bg-white" value={value} onChange={(e) => onChange(e.target.value as AppLocale)}>
          {SUPPORTED_LOCALES.map((code) => (
            <option key={code} value={code}>
              {LOCALE_META[code].nativeName}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="block text-sm">
      {t('language')}
      <select className="w-full border rounded px-2 py-1 mt-1" value={value} onChange={(e) => onChange(e.target.value as AppLocale)}>
        {SUPPORTED_LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_META[code].nativeName}
          </option>
        ))}
      </select>
      <span className="text-xs text-stone-500 mt-1 block">{t('languageHint')}</span>
    </label>
  );
}
