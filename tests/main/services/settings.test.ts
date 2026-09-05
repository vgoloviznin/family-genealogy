import { describe, expect, it } from 'vitest';
import { getSettings, updateSettings, assertOnboardingComplete, getDefaultBackupFolder } from '@main/services/settings';
import { localizedErrorMessage } from '../../helpers/localized-error';

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

  it('requires editor label and backup folder to complete onboarding', () => {
    updateSettings({ onboardingComplete: false, editorLabel: '', backupFolder: '' });
    expect(() => assertOnboardingComplete()).toThrow(localizedErrorMessage('errors.onboardingRequired'));
    expect(() => updateSettings({ onboardingComplete: true })).toThrow(localizedErrorMessage('errors.onboardingRequired'));
    updateSettings({ editorLabel: 'Tester', backupFolder: getDefaultBackupFolder(), onboardingComplete: true });
    expect(() => assertOnboardingComplete()).not.toThrow();
    updateSettings({ onboardingComplete: false, editorLabel: '', backupFolder: '' });
  });
});
