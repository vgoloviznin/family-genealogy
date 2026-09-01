import type { AppLocale } from '@shared/types';
import ru from './ru.json';
import en from './en.json';
import it from './it.json';

export { type AppLocale };

export const DEFAULT_LOCALE: AppLocale = 'ru';

export const SUPPORTED_LOCALES: AppLocale[] = ['ru', 'en', 'it'];

export const LOCALE_META: Record<AppLocale, { nativeName: string }> = {
  ru: { nativeName: 'Русский' },
  en: { nativeName: 'English' },
  it: { nativeName: 'Italiano' }
};

export const localeResources = { ru, en, it } as const;

export function validateLocale(value: unknown): AppLocale {
  if (value === 'ru' || value === 'en' || value === 'it') {
    return value;
  }
  return DEFAULT_LOCALE;
}

function getNested(obj: Record<string, unknown>, key: string): string | undefined {
  const parts = key.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof cur === 'string' ? cur : undefined;
}

export function translate(locale: AppLocale, key: string, params?: Record<string, string | number>): string {
  const messages = localeResources[locale] ?? localeResources[DEFAULT_LOCALE];
  let text = getNested(messages as Record<string, unknown>, key) ?? key;
  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{\\{${paramKey}\\}\\}`, 'g'), String(paramValue));
    }
  }
  return text;
}

export function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

export function mergeColumnLabelKey(column: string): string {
  return `merge.column.${column}`;
}
