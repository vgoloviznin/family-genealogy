import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createTestProjectDir, createTestProjectFiles } from '../../helpers/project-fixture';
import { isSqliteAvailable } from '../../helpers/sqlite-available';
import { closeProject, openProjectAtPath, updateProjectName, listRecentProjects } from '@main/services/project';
import { localizedErrorMessage } from '../../helpers/localized-error';

const recentPaths: string[] = [];

vi.mock('@main/services/settings', () => ({
  getSettings: () => ({
    deviceId: 'test-device',
    editorLabel: '',
    backupOnQuit: false,
    backupKeepCount: 10,
    recentProjects: recentPaths
  }),
  pruneRecentProjects: (missing: string[]) => {
    const drop = new Set(missing);
    for (let i = recentPaths.length - 1; i >= 0; i--) {
      if (drop.has(recentPaths[i])) {
        recentPaths.splice(i, 1);
      }
    }
  },
  addRecentProject: vi.fn((path: string) => {
    const filtered = recentPaths.filter((p) => p !== path);
    filtered.unshift(path);
    recentPaths.length = 0;
    recentPaths.push(...filtered.slice(0, 10));
  })
}));

vi.mock('@main/services/undo', () => ({
  clearUndo: vi.fn(),
  recordUndo: vi.fn(),
  withUndoSuppressed: async (fn: () => unknown) => await fn()
}));

describe('project service', () => {
  afterEach(() => {
    closeProject();
    recentPaths.length = 0;
  });

  describe.skipIf(!isSqliteAvailable())('updateProjectName', () => {
    it('persists trimmed name to project.json and current project', () => {
      const project = createTestProjectDir('Old Name');
      try {
        openProjectAtPath(project.path);
        const updated = updateProjectName('  New Name  ');
        expect(updated.name).toBe('New Name');
        const json = JSON.parse(readFileSync(join(project.path, 'project.json'), 'utf-8'));
        expect(json.name).toBe('New Name');
      } finally {
        closeProject();
        project.cleanup();
      }
    });

    it('rejects empty project name', () => {
      const project = createTestProjectDir('Stable');
      try {
        openProjectAtPath(project.path);
        expect(() => updateProjectName('   ')).toThrow(localizedErrorMessage('errors.projectNameEmpty'));
      } finally {
        closeProject();
        project.cleanup();
      }
    });
  });

  describe('listRecentProjects', () => {
    it('reads project names from project.json instead of folder names', () => {
      const alpha = createTestProjectFiles('Family Alpha');
      const beta = createTestProjectFiles('Family Beta');
      try {
        recentPaths.push(beta.path, alpha.path);
        const recents = listRecentProjects();
        expect(recents).toEqual([
          { path: beta.path, name: 'Family Beta' },
          { path: alpha.path, name: 'Family Alpha' }
        ]);
      } finally {
        alpha.cleanup();
        beta.cleanup();
      }
    });

    it('drops missing projects from recents', () => {
      const project = createTestProjectFiles('Temporary');
      const missingPath = join(project.path, 'missing');
      project.cleanup();
      recentPaths.push(missingPath);
      expect(listRecentProjects()).toEqual([]);
      expect(recentPaths).toEqual([]);
    });
  });
});
