import { describe, expect, it } from 'vitest';
import { folderNameFromPath, normalizeRecentProjects } from '@shared/recents';

describe('normalizeRecentProjects', () => {
  it('keeps objects with project names', () => {
    expect(normalizeRecentProjects([{ path: '/tmp/family-archive', name: 'Моё семейное древо' }])).toEqual([
      { path: '/tmp/family-archive', name: 'Моё семейное древо' }
    ]);
  });

  it('turns legacy path strings into recents', () => {
    expect(normalizeRecentProjects(['/Users/me/Documents/Goloviznin'])).toEqual([{ path: '/Users/me/Documents/Goloviznin', name: 'Goloviznin' }]);
  });

  it('falls back to the folder name when the project name is empty', () => {
    expect(normalizeRecentProjects([{ path: '/tmp/family-archive', name: '  ' }])).toEqual([{ path: '/tmp/family-archive', name: 'family-archive' }]);
  });
});

describe('folderNameFromPath', () => {
  it('handles windows paths', () => {
    expect(folderNameFromPath('C:\\Users\\me\\Tree')).toBe('Tree');
  });
});
