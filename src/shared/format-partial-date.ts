import type { AppLocale, PartialDate } from './types';
import { translate } from './locales';

export function formatPartialDate(date: PartialDate, locale: AppLocale): string {
  if (date.originalText) {
    return date.originalText;
  }
  const parts: string[] = [];
  if (date.precision === 'circa') {
    parts.push(translate(locale, 'dateField.circaShort'));
  }
  if (date.precision === 'before') {
    parts.push(translate(locale, 'dateField.beforeShort'));
  }
  if (date.precision === 'after') {
    parts.push(translate(locale, 'dateField.afterShort'));
  }
  if (date.day) {
    parts.push(String(date.day).padStart(2, '0'));
  }
  if (date.month) {
    parts.push(String(date.month).padStart(2, '0'));
  }
  if (date.year) {
    parts.push(String(date.year));
  }
  if (date.hour != null && date.minute != null) {
    parts.push(`${String(date.hour).padStart(2, '0')}:${String(date.minute).padStart(2, '0')}`);
  }
  return parts.join('.') || translate(locale, 'dateField.empty');
}
