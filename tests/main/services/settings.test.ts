import { describe, expect, it } from 'vitest';
import { getSettings, updateSettings } from '@main/services/settings';

describe('settings locale', () => {
  it('defaults locale to ru', () => {
    const settings = getSettings();
    expect(settings.locale).toBe('ru');
  });

  it('persists locale changes', () => {
    const updated = updateSettings({ locale: 'en' });
    expect(updated.locale).toBe('en');
    expect(getSettings().locale).toBe('en');
    updateSettings({ locale: 'ru' });
  });

  it('normalizes invalid locale on read', () => {
    updateSettings({ locale: 'xx' as never });
    expect(getSettings().locale).toBe('ru');
    updateSettings({ locale: 'ru' });
  });

  it('accepts supported locales', () => {
    for (const locale of ['en', 'it', 'ru'] as const) {
      updateSettings({ locale });
      expect(getSettings().locale).toBe(locale);
    }
    updateSettings({ locale: 'ru' });
  });
});
