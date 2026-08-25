import { homedir } from 'os';
import { join } from 'path';

const CLOUD_MARKERS = [
  'Dropbox',
  'iCloud Drive',
  'OneDrive',
  'Google Drive',
  'GoogleDrive',
  'Box Sync',
  'Box',
  'Mega',
  'Mobile Documents/com~apple~CloudDocs'
];

export function isCloudSyncedPath(projectPath: string): boolean {
  const normalized = projectPath.replace(/\\/g, '/');
  const home = homedir().replace(/\\/g, '/');

  for (const marker of CLOUD_MARKERS) {
    if (normalized.includes(marker)) {
      return true;
    }
  }

  // macOS iCloud container path
  if (normalized.includes(join(home, 'Library/Mobile Documents').replace(/\\/g, '/'))) {
    return true;
  }

  return false;
}

export function isDirectoryEmptyExcept(entries: string[], allowed: string[] = []): boolean {
  const allowedSet = new Set(allowed);
  return entries.every((e) => allowedSet.has(e) || e.startsWith('.'));
}
