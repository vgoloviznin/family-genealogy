import { createHash } from 'crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { dialog, BrowserWindow, app } from 'electron';
import { ZipArchive } from 'archiver';
import { extractZip } from '../utils/safe-extract-zip';
import { checkpointDatabase } from '../db/connection';
import { getProjectJson, openProjectAtPath, requireProject, closeProject } from './project';
import { getSettings } from './settings';
import { clearUndo } from './undo';
import { mergeIncomingDatabase } from './merge';
import { SCHEMA_VERSION } from '../db/schema';
import { FGTREE_FORMAT, readPackManifest, verifyPackDatabaseHash } from '@shared/pack-manifest';
import type {
  BatchMergeApplyResult,
  BatchMergePreviewResult,
  MergeApplyResult,
  MergeConflictResolution,
  MergePreviewResult
} from '@shared/merge-types';
import type { PackProgress, ProjectMeta } from '@shared/types';

const FORMAT = FGTREE_FORMAT;
const FORMAT_VERSION = 1;

let progressCallback: ((p: PackProgress) => void) | null = null;

export function setPackProgressCallback(cb: ((p: PackProgress) => void) | null): void {
  progressCallback = cb;
}

export function emitPackProgress(progress: PackProgress): void {
  progressCallback?.(progress);
  BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('pack:progress', progress));
}

function emitProgress(progress: PackProgress): void {
  emitPackProgress(progress);
}

function sha256File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(path);
    stream.on('data', (d) => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function buildManifest(projectPath: string, kind: 'export' | 'backup'): Promise<object> {
  const json = getProjectJson(projectPath);
  const dbPath = join(projectPath, 'family.sqlite');
  const dbHash = await sha256File(dbPath);
  const mediaDir = join(projectPath, 'media');
  const mediaFiles: Array<{ path: string; size: number }> = [];
  const settings = getSettings();

  if (existsSync(mediaDir)) {
    for (const file of readdirSync(mediaDir)) {
      const p = join(mediaDir, file);
      if (statSync(p).isFile()) {
        mediaFiles.push({ path: `media/${file}`, size: statSync(p).size });
      }
    }
  }

  return {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    kind,
    appVersion: app.getVersion(),
    schemaVersion: SCHEMA_VERSION,
    projectId: json.projectId,
    projectName: json.name,
    exportedAt: new Date().toISOString(),
    sourceDeviceId: settings.deviceId,
    editorLabel: settings.editorLabel,
    sqliteSha256: dbHash,
    mediaFiles
  };
}

/** Unpack .fgtree into a fresh temp dir (does not open as current project). */
export async function extractArchiveToTemp(archivePath: string): Promise<string> {
  const tempDir = mkdtempSync(join(tmpdir(), 'fgtree-sync-'));
  emitProgress({ phase: 'merge', current: 0, total: 100, message: 'Распаковка архива…' });
  await extractZip(archivePath, { dir: tempDir });
  return tempDir;
}

export async function verifyExtractedArchive(tempDir: string): Promise<ReturnType<typeof readPackManifest>> {
  const manifestPath = join(tempDir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    throw new Error('Неверный файл: нет manifest.json');
  }
  const manifest = readPackManifest(manifestPath);
  const dbPath = join(tempDir, 'family.sqlite');
  if (!existsSync(dbPath)) {
    throw new Error('В архиве нет family.sqlite');
  }
  emitProgress({ phase: 'merge', current: 30, total: 100, message: 'Проверка архива…' });
  await verifyPackDatabaseHash(manifest, dbPath, sha256File);
  return manifest;
}

export async function packProjectArchive(projectPath: string, outputPath: string, kind: 'export' | 'backup'): Promise<string> {
  checkpointDatabase();
  const manifest = await buildManifest(projectPath, kind);
  mkdirSync(dirname(outputPath), { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = new ZipArchive({ zlib: { level: 6 } });
    output.on('close', () => resolve());
    archive.on('error', reject);
    archive.on('progress', (p) => {
      emitProgress({
        phase: 'pack',
        current: p.fs.processedBytes ?? 0,
        total: p.fs.totalBytes ?? 0,
        message: 'Упаковка проекта…'
      });
    });
    archive.pipe(output);
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
    archive.file(join(projectPath, 'project.json'), { name: 'project.json' });
    archive.file(join(projectPath, 'family.sqlite'), { name: 'family.sqlite' });
    if (existsSync(join(projectPath, 'media'))) {
      archive.directory(join(projectPath, 'media'), 'media');
    }
    if (existsSync(join(projectPath, 'thumbs'))) {
      archive.directory(join(projectPath, 'thumbs'), 'thumbs');
    }
    archive.finalize();
  });

  return outputPath;
}

export async function unpackProjectArchive(archivePath: string, destPath: string): Promise<ProjectMeta> {
  const entries = existsSync(destPath) ? readdirSync(destPath).filter((e) => !e.startsWith('.')) : [];
  if (entries.length > 0) {
    throw new Error('Папка назначения не пуста');
  }

  mkdirSync(destPath, { recursive: true });
  emitProgress({ phase: 'unpack', current: 0, total: 100, message: 'Распаковка…' });
  await extractZip(archivePath, { dir: destPath });

  const manifestPath = join(destPath, 'manifest.json');
  if (!existsSync(manifestPath)) {
    throw new Error('Неверный файл: нет manifest.json');
  }
  const manifest = readPackManifest(manifestPath);

  const dbPath = join(destPath, 'family.sqlite');
  await verifyPackDatabaseHash(manifest, dbPath, sha256File);

  closeProject();
  return openProjectAtPath(destPath);
}

function rotateBackups(backupFolder: string, projectName: string, keep: number): void {
  if (!existsSync(backupFolder)) {
    return;
  }
  const prefix = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const files = readdirSync(backupFolder)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.fgtree'))
    .map((f) => ({ name: f, mtime: statSync(join(backupFolder, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const f of files.slice(keep)) {
    rmSync(join(backupFolder, f.name));
  }
}

export async function exportProject(): Promise<string | null> {
  const project = requireProject();
  const result = await dialog.showSaveDialog({
    title: 'Экспорт проекта',
    defaultPath: `${project.name}.fgtree`,
    filters: [{ name: 'Family Geneology', extensions: ['fgtree'] }]
  });
  if (result.canceled || !result.filePath) {
    return null;
  }
  return packProjectArchive(project.path, result.filePath, 'export');
}

export async function importProject(): Promise<ProjectMeta | null> {
  const fileResult = await dialog.showOpenDialog({
    title: 'Импорт проекта',
    filters: [{ name: 'Family Geneology', extensions: ['fgtree'] }],
    properties: ['openFile']
  });
  if (fileResult.canceled || !fileResult.filePaths[0]) {
    return null;
  }

  const folderResult = await dialog.showOpenDialog({
    title: 'Папка для развёртывания проекта',
    properties: ['openDirectory', 'createDirectory']
  });
  if (folderResult.canceled || !folderResult.filePaths[0]) {
    return null;
  }

  return unpackProjectArchive(fileResult.filePaths[0], folderResult.filePaths[0]);
}

export async function backupProject(): Promise<string | null> {
  const project = requireProject();
  const settings = getSettings();
  const backupFolder = settings.backupFolder ?? join(project.path, 'Backups');
  mkdirSync(backupFolder, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  const safeName = project.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const outPath = join(backupFolder, `${safeName}_${stamp}.fgtree`);
  const result = await packProjectArchive(project.path, outPath, 'backup');
  rotateBackups(backupFolder, safeName, settings.backupKeepCount);
  return result;
}

export async function restoreProject(): Promise<ProjectMeta | null> {
  const fileResult = await dialog.showOpenDialog({
    title: 'Восстановить из архива',
    filters: [{ name: 'Family Geneology', extensions: ['fgtree'] }],
    properties: ['openFile']
  });
  if (fileResult.canceled || !fileResult.filePaths[0]) {
    return null;
  }

  const folderResult = await dialog.showOpenDialog({
    title: 'Папка для восстановления',
    properties: ['openDirectory', 'createDirectory']
  });
  if (folderResult.canceled || !folderResult.filePaths[0]) {
    return null;
  }

  return unpackProjectArchive(fileResult.filePaths[0], folderResult.filePaths[0]);
}

export async function backupOnQuitIfEnabled(): Promise<void> {
  const settings = getSettings();
  if (!settings.backupOnQuit) {
    return;
  }
  try {
    requireProject();
    await backupProject();
  } catch {
    // no open project
  }
}

export async function handleOpenFgtreeFile(filePath: string): Promise<ProjectMeta | null> {
  const folderResult = await dialog.showOpenDialog({
    title: 'Папка для развёртывания проекта',
    properties: ['openDirectory', 'createDirectory']
  });
  if (folderResult.canceled || !folderResult.filePaths[0]) {
    return null;
  }
  return unpackProjectArchive(filePath, folderResult.filePaths[0]);
}

export async function previewSyncFromArchivePath(archivePath: string): Promise<MergePreviewResult> {
  const project = requireProject();
  if (!existsSync(archivePath)) {
    throw new Error('Файл архива не найден');
  }

  let tempDir: string | null = null;
  try {
    tempDir = await extractArchiveToTemp(archivePath);
    await verifyExtractedArchive(tempDir);
    emitProgress({ phase: 'merge', current: 60, total: 100, message: 'Сравнение изменений…' });
    const result = await mergeIncomingDatabase({
      mode: 'preview',
      localProjectPath: project.path,
      incomingProjectPath: tempDir
    });
    emitProgress({ phase: 'merge', current: 100, total: 100, message: 'Готово' });
    if ('applied' in result) {
      throw new Error('Ожидался preview, получен apply');
    }
    return { ...result, archivePath };
  } finally {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

export interface ApplySyncOptions {
  /** When false, skip autobackup (batch creates one backup for the whole chain). Default true. */
  createBackup?: boolean;
  /** Backup path to report on the result when createBackup is false. */
  backupPath?: string | null;
  /** When false, leave undo stack for the caller (batch clears once at end). Default true. */
  clearUndoAfter?: boolean;
}

export async function applySyncFromArchivePath(
  archivePath: string,
  resolutions: MergeConflictResolution[],
  options: ApplySyncOptions = {}
): Promise<MergeApplyResult> {
  const project = requireProject();
  if (!existsSync(archivePath)) {
    throw new Error('Файл архива не найден');
  }

  const createBackup = options.createBackup !== false;
  const clearUndoAfter = options.clearUndoAfter !== false;

  let tempDir: string | null = null;
  try {
    tempDir = await extractArchiveToTemp(archivePath);
    const manifest = await verifyExtractedArchive(tempDir);
    if (manifest.projectId !== project.projectId) {
      throw new Error('Это архив другого проекта');
    }

    let backupPath = options.backupPath ?? null;
    if (createBackup) {
      backupPath = await backupProject();
      if (!backupPath) {
        throw new Error('Не удалось создать резервную копию');
      }
    }

    emitProgress({ phase: 'merge', current: 60, total: 100, message: 'Слияние данных…' });
    const result = await mergeIncomingDatabase({
      mode: 'apply',
      localProjectPath: project.path,
      incomingProjectPath: tempDir,
      resolutions,
      backupPath
    });
    if (clearUndoAfter) {
      clearUndo();
    }
    emitProgress({ phase: 'merge', current: 100, total: 100, message: 'Готово' });
    return result as MergeApplyResult;
  } finally {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

export async function previewSyncFromArchive(): Promise<MergePreviewResult | null> {
  requireProject();
  const fileResult = await dialog.showOpenDialog({
    title: 'Синхронизация из архива',
    filters: [{ name: 'Family Geneology', extensions: ['fgtree'] }],
    properties: ['openFile']
  });
  if (fileResult.canceled || !fileResult.filePaths[0]) {
    return null;
  }
  return previewSyncFromArchivePath(fileResult.filePaths[0]);
}

export async function applySyncFromArchive(archivePath: string, resolutions: MergeConflictResolution[]): Promise<MergeApplyResult> {
  requireProject();
  return applySyncFromArchivePath(archivePath, resolutions);
}

export async function previewSyncFromArchives(): Promise<BatchMergePreviewResult | null> {
  requireProject();
  const fileResult = await dialog.showOpenDialog({
    title: 'Синхронизация нескольких архивов',
    filters: [{ name: 'Family Geneology', extensions: ['fgtree'] }],
    properties: ['openFile', 'multiSelections']
  });
  if (fileResult.canceled || fileResult.filePaths.length === 0) {
    return null;
  }
  const { previewBatchSync } = await import('./merge-batch');
  return previewBatchSync(fileResult.filePaths);
}

export async function applySyncFromArchives(archivePaths: string[], resolutions: MergeConflictResolution[]): Promise<BatchMergeApplyResult> {
  requireProject();
  const { applyBatchSync } = await import('./merge-batch');
  return applyBatchSync(archivePaths, resolutions);
}

export async function previewSyncFromArchivePaths(archivePaths: string[]): Promise<BatchMergePreviewResult> {
  const { previewBatchSync } = await import('./merge-batch');
  return previewBatchSync(archivePaths);
}

export async function applySyncFromArchivePaths(archivePaths: string[], resolutions: MergeConflictResolution[]): Promise<BatchMergeApplyResult> {
  const { applyBatchSync } = await import('./merge-batch');
  return applyBatchSync(archivePaths, resolutions);
}
