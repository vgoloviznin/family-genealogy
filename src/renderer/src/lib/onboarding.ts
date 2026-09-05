import type { AppSettings } from '@shared/types';

export function needsOnboarding(settings: AppSettings | null | undefined): boolean {
  return !settings || settings.onboardingComplete !== true;
}

export function canCompleteOnboarding(editorLabel: string, backupFolder: string): boolean {
  return Boolean(editorLabel.trim() && backupFolder.trim());
}
