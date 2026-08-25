import { app, dialog } from 'electron';
import Store from 'electron-store';
import { v7 as uuidv7 } from 'uuid';
import type { AppSettings } from '@shared/types';

const defaults: AppSettings = {
  deviceId: uuidv7(),
  editorLabel: '',
  backupOnQuit: true,
  backupKeepCount: 10,
  recentProjects: []
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

export function getSettings(): AppSettings {
  const s = getStore();
  const data = s.store;
  if (!data.deviceId) {
    data.deviceId = uuidv7();
    s.set('deviceId', data.deviceId);
  }
  return data;
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const s = getStore();
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

export async function pickFolder(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'Папка бэкапов',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths[0]) {
    return null;
  }
  return result.filePaths[0];
}
