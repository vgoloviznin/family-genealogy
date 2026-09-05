import { useTranslation } from 'react-i18next';
import type { AppLocale } from '@shared/types';
import { LOCALE_META, SUPPORTED_LOCALES } from '@shared/locales';

/**
 * Button group instead of native &lt;select&gt;: OS dropdowns in Electron often deliver a
 * click-through to whatever is under the popup (e.g. the tree pane), clearing selection.
 */
export function LocaleSelect({ value, onChange, compact = false }: { value: AppLocale; onChange: (locale: AppLocale) => void; compact?: boolean }) {
  const { t } = useTranslation();

  const buttons = (
    <div className={`flex flex-wrap gap-1.5 ${compact ? '' : 'mt-1'}`} role="group" aria-label={t('language')}>
      {SUPPORTED_LOCALES.map((code) => {
        const active = value === code;
        return (
          <button
            key={code}
            type="button"
            className={`px-2.5 py-1 rounded-md text-sm border transition-colors ${
              active ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
            }`}
            aria-pressed={active}
            onClick={() => onChange(code)}
          >
            {LOCALE_META[code].nativeName}
          </button>
        );
      })}
    </div>
  );

  if (compact) {
    return (
      <div className="text-sm flex items-center gap-2 flex-wrap">
        <span className="text-stone-600 shrink-0">{t('language')}</span>
        {buttons}
      </div>
    );
  }

  return (
    <div className="block text-sm">
      <div className="font-medium text-stone-700">{t('language')}</div>
      {buttons}
      <span className="text-xs text-stone-500 mt-1 block">{t('languageHint')}</span>
    </div>
  );
}
