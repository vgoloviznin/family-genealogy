import type { RecentProject } from './types';

export function folderNameFromPath(projectPath: string): string {
  const parts = projectPath.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? projectPath;
}

export function normalizeRecentProjects(raw: unknown): RecentProject[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const recents: RecentProject[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item) {
      recents.push({ path: item, name: folderNameFromPath(item) });
      continue;
    }
    if (!item || typeof item !== 'object') {
      continue;
    }
    const record = item as { path?: unknown; name?: unknown };
    if (typeof record.path !== 'string' || !record.path) {
      continue;
    }
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    recents.push({ path: record.path, name: name || folderNameFromPath(record.path) });
  }
  return recents;
}
