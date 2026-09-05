import { app } from 'electron';
import { join } from 'path';
import Store from 'electron-store';
import { v7 as uuidv7 } from 'uuid';
import type { AppSettings } from '@shared/types';
import { validateLocale } from '@shared/locales';
import { localizedError } from '../i18n';

const defaults: AppSettings = {
  deviceId: uuidv7(),
  editorLabel: '',
  locale: 'ru',
  backupOnQuit: true,
  backupKeepCount: 10,
  recentProjects: [],
  onboardingComplete: false
};

let store: Store<AppSettings> | null = null;

function getStore(): Store<AppSettings> {
  if (!store) {
    store = new Store<AppSettings>({
      name: 'settings',
      cwd: app.getPath('userData'),
      defaults
    });
  }
  return store;
}

export function getDefaultBackupFolder(): string {
  return join(app.getPath('userData'), 'Backups');
}

export function getSettings(): AppSettings {
  const s = getStore();
  const data = s.store;
  if (!data.deviceId) {
    data.deviceId = uuidv7();
    s.set('deviceId', data.deviceId);
  }
  const locale = validateLocale(data.locale);
  if (data.locale !== locale) {
    s.set('locale', locale);
    data.locale = locale;
  }
  return data;
}

function onboardingFieldsReady(settings: AppSettings): boolean {
  return Boolean(settings.editorLabel?.trim() && settings.backupFolder?.trim());
}

export function assertOnboardingComplete(): void {
  const settings = getSettings();
  if (settings.onboardingComplete === true && onboardingFieldsReady(settings)) {
    return;
  }
  throw new Error(localizedError('errors.onboardingRequired'));
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const s = getStore();
  const next: AppSettings = { ...getSettings(), ...partial };
  if (next.onboardingComplete && !onboardingFieldsReady(next)) {
    throw new Error(localizedError('errors.onboardingRequired'));
  }
  for (const [key, value] of Object.entries(partial)) {
    if (value !== undefined) {
      s.set(key as keyof AppSettings, value as never);
    }
  }
  return getSettings();
}

export function addRecentProject(path: string): void {
  const settings = getSettings();
  const filtered = settings.recentProjects.filter((p) => p !== path);
  filtered.unshift(path);
  getStore().set('recentProjects', filtered.slice(0, 10));
}

export function pruneRecentProjects(missingPaths: string[]): void {
  if (missingPaths.length === 0) {
    return;
  }
  const drop = new Set(missingPaths);
  const filtered = getSettings().recentProjects.filter((p) => !drop.has(p));
  getStore().set('recentProjects', filtered);
}

export function getDeviceMeta(): { deviceId: string; label: string } {
  const s = getSettings();
  return { deviceId: s.deviceId, label: s.editorLabel };
}
