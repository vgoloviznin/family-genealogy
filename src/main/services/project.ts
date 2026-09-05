import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'fs';
import { basename, join } from 'path';
import { dialog } from 'electron';
import { openDatabase, closeDatabase } from '../db/connection';
import { SCHEMA_VERSION } from '../db/schema';
import { newId, nowIso } from '../utils/id';
import { isCloudSyncedPath } from '../utils/paths';
import { addRecentProject, getSettings, pruneRecentProjects, assertOnboardingComplete } from './settings';
import { clearUndo } from './undo';
import { localizedError, t, getAppLocale } from '../i18n';
import type { ProjectMeta, RecentProject } from '@shared/types';

export interface ProjectJson {
  projectId: string;
  name: string;
  schemaVersion: number;
  createdAt: string;
}

let currentProject: ProjectMeta | null = null;

export function getCurrentProject(): ProjectMeta | null {
  return currentProject;
}

export function closeProject(): void {
  closeDatabase();
  currentProject = null;
  clearUndo();
}

function writeProjectJson(projectPath: string, data: ProjectJson): void {
  writeFileSync(join(projectPath, 'project.json'), JSON.stringify(data, null, 2), 'utf-8');
}

function readProjectJson(projectPath: string): ProjectJson {
  const raw = readFileSync(join(projectPath, 'project.json'), 'utf-8');
  return JSON.parse(raw) as ProjectJson;
}

function ensureProjectDirs(projectPath: string): void {
  mkdirSync(join(projectPath, 'media'), { recursive: true });
  mkdirSync(join(projectPath, 'thumbs'), { recursive: true });
}

export async function createProject(name: string): Promise<ProjectMeta | null> {
  assertOnboardingComplete();
  const result = await dialog.showOpenDialog({
    title: t(getAppLocale(), 'dialog.createProjectFolder'),
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths[0]) {
    return null;
  }
  const projectPath = result.filePaths[0];
  const entries = existsSync(projectPath) ? readdirSync(projectPath) : [];
  const visible = entries.filter((e) => !e.startsWith('.'));
  if (visible.length > 0) {
    throw new Error(localizedError('errors.folderNotEmpty'));
  }

  ensureProjectDirs(projectPath);
  const projectJson: ProjectJson = {
    projectId: newId(),
    name,
    schemaVersion: 0,
    createdAt: nowIso()
  };
  writeProjectJson(projectPath, projectJson);
  return openProjectAtPath(projectPath, { createIfMissing: true });
}

export async function openProject(): Promise<ProjectMeta | null> {
  assertOnboardingComplete();
  const result = await dialog.showOpenDialog({
    title: t(getAppLocale(), 'dialog.openProject'),
    properties: ['openDirectory']
  });
  if (result.canceled || !result.filePaths[0]) {
    return null;
  }
  return openProjectAtPath(result.filePaths[0]);
}

export function openProjectAtPath(projectPath: string, options?: { createIfMissing?: boolean }): ProjectMeta {
  const dbFile = join(projectPath, 'family.sqlite');
  const jsonFile = join(projectPath, 'project.json');
  if (!existsSync(jsonFile)) {
    throw new Error(localizedError('errors.notAProject'));
  }

  const json = readProjectJson(projectPath);
  if (typeof json.schemaVersion === 'number' && json.schemaVersion > SCHEMA_VERSION) {
    throw new Error(localizedError('errors.projectNewerVersion'));
  }

  if (!existsSync(dbFile)) {
    if (!options?.createIfMissing) {
      throw new Error(localizedError('errors.databaseMissing'));
    }
    ensureProjectDirs(projectPath);
  }

  closeProject();
  openDatabase(projectPath);

  const cloudWarning = isCloudSyncedPath(projectPath);

  currentProject = {
    projectId: json.projectId,
    name: json.name,
    schemaVersion: json.schemaVersion,
    createdAt: json.createdAt,
    path: projectPath,
    cloudWarning
  };

  if (json.schemaVersion < SCHEMA_VERSION) {
    json.schemaVersion = SCHEMA_VERSION;
    writeProjectJson(projectPath, json);
    currentProject.schemaVersion = SCHEMA_VERSION;
  }

  addRecentProject(projectPath);
  return currentProject;
}

export function requireProject(): ProjectMeta {
  if (!currentProject) {
    throw new Error(localizedError('errors.projectNotOpen'));
  }
  return currentProject;
}

export function getProjectJson(projectPath: string): ProjectJson {
  return readProjectJson(projectPath);
}

export function listRecentProjects(): RecentProject[] {
  const recents: RecentProject[] = [];
  const missing: string[] = [];

  for (const entry of getSettings().recentProjects) {
    const projectPath = typeof entry === 'string' ? entry : '';
    if (!projectPath) {
      continue;
    }
    const jsonFile = join(projectPath, 'project.json');
    if (!existsSync(jsonFile)) {
      missing.push(projectPath);
      continue;
    }
    try {
      const json = readProjectJson(projectPath);
      const name = typeof json.name === 'string' ? json.name.trim() : '';
      recents.push({
        path: projectPath,
        name: name || basename(projectPath)
      });
    } catch {
      recents.push({ path: projectPath, name: basename(projectPath) });
    }
  }

  if (missing.length > 0) {
    pruneRecentProjects(missing);
  }
  return recents;
}

export function updateProjectName(name: string): ProjectMeta {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error(localizedError('errors.projectNameEmpty'));
  }
  const project = requireProject();
  const json = readProjectJson(project.path);
  json.name = trimmed;
  writeProjectJson(project.path, json);
  currentProject = { ...project, name: trimmed };
  return currentProject;
}
