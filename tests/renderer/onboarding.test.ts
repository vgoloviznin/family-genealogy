import { describe, expect, it } from 'vitest';
import { needsOnboarding, canCompleteOnboarding } from '@renderer/lib/onboarding';

describe('onboarding gate', () => {
  it('requires onboarding when the flag is missing', () => {
    expect(needsOnboarding(null)).toBe(true);
    expect(
      needsOnboarding({
        deviceId: 'd',
        editorLabel: 'Me',
        locale: 'ru',
        backupOnQuit: true,
        backupKeepCount: 10,
        recentProjects: [],
        backupFolder: '/tmp/backups'
      })
    ).toBe(true);
  });

  it('skips only when onboardingComplete is true', () => {
    expect(
      needsOnboarding({
        deviceId: 'd',
        editorLabel: '',
        locale: 'ru',
        backupOnQuit: true,
        backupKeepCount: 10,
        recentProjects: [],
        onboardingComplete: true
      })
    ).toBe(false);
  });

  it('validates completion fields', () => {
    expect(canCompleteOnboarding('', '/tmp')).toBe(false);
    expect(canCompleteOnboarding('Me', '')).toBe(false);
    expect(canCompleteOnboarding('Me', '/tmp/backups')).toBe(true);
  });
});
