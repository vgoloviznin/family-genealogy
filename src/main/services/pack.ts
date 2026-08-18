import { createHash } from 'crypto'
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { dialog, BrowserWindow, app } from 'electron'
import archiver from 'archiver'
import extract from 'extract-zip'
import { checkpointDatabase, closeDatabase } from '../db/connection'
import { getProjectJson, openProjectAtPath, requireProject, closeProject } from './project'
import { getSettings } from './settings'
import { SCHEMA_VERSION } from '../db/schema'
import type { PackProgress, ProjectMeta } from '@shared/types'

const FORMAT = 'fgtree'
const FORMAT_VERSION = 1

let progressCallback: ((p: PackProgress) => void) | null = null

export function setPackProgressCallback(cb: ((p: PackProgress) => void) | null): void {
  progressCallback = cb
}

function emitProgress(progress: PackProgress): void {
  progressCallback?.(progress)
  BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('pack:progress', progress))
}

function sha256File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(path)
    stream.on('data', (d) => hash.update(d))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

async function buildManifest(projectPath: string, kind: 'export' | 'backup'): Promise<object> {
  const json = getProjectJson(projectPath)
  const dbPath = join(projectPath, 'family.sqlite')
  const dbHash = await sha256File(dbPath)
  const mediaDir = join(projectPath, 'media')
  const mediaFiles: Array<{ path: string; size: number }> = []

  if (existsSync(mediaDir)) {
    for (const file of readdirSync(mediaDir)) {
      const p = join(mediaDir, file)
      if (statSync(p).isFile()) {
        mediaFiles.push({ path: `media/${file}`, size: statSync(p).size })
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
    sourceDeviceId: getSettings().deviceId,
    sqliteSha256: dbHash,
    mediaFiles
  }
}

async function packProject(projectPath: string, outputPath: string, kind: 'export' | 'backup'): Promise<string> {
  checkpointDatabase()
  const manifest = await buildManifest(projectPath, kind)
  mkdirSync(dirname(outputPath), { recursive: true })

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(outputPath)
    const archive = archiver('zip', { zlib: { level: 6 } })
    output.on('close', () => resolve())
    archive.on('error', reject)
    archive.on('progress', (p) => {
      emitProgress({
        phase: 'pack',
        current: p.fs.processedBytes ?? 0,
        total: p.fs.totalBytes ?? 0,
        message: 'Упаковка проекта…'
      })
    })
    archive.pipe(output)
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' })
    archive.file(join(projectPath, 'project.json'), { name: 'project.json' })
    archive.file(join(projectPath, 'family.sqlite'), { name: 'family.sqlite' })
    if (existsSync(join(projectPath, 'media'))) {
      archive.directory(join(projectPath, 'media'), 'media')
    }
    if (existsSync(join(projectPath, 'thumbs'))) {
      archive.directory(join(projectPath, 'thumbs'), 'thumbs')
    }
    archive.finalize()
  })

  return outputPath
}

async function unpackProject(archivePath: string, destPath: string): Promise<ProjectMeta> {
  const entries = existsSync(destPath) ? readdirSync(destPath).filter((e) => !e.startsWith('.')) : []
  if (entries.length > 0) {
    throw new Error('Папка назначения не пуста')
  }

  mkdirSync(destPath, { recursive: true })
  emitProgress({ phase: 'unpack', current: 0, total: 100, message: 'Распаковка…' })
  await extract(archivePath, { dir: destPath })

  const manifestPath = join(destPath, 'manifest.json')
  if (!existsSync(manifestPath)) throw new Error('Неверный файл: нет manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
  if (manifest.format !== FORMAT) throw new Error('Неверный формат архива')

  const dbPath = join(destPath, 'family.sqlite')
  const actualHash = await sha256File(dbPath)
  if (manifest.sqliteSha256 && manifest.sqliteSha256 !== actualHash) {
    throw new Error('Кontрольная сумма базы данных не совпадает')
  }

  closeProject()
  return openProjectAtPath(destPath)
}

function rotateBackups(backupFolder: string, projectName: string, keep: number): void {
  if (!existsSync(backupFolder)) return
  const prefix = projectName.replace(/[^a-zA-Z0-9_-]/g, '_')
  const files = readdirSync(backupFolder)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.fgtree'))
    .map((f) => ({ name: f, mtime: statSync(join(backupFolder, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)

  for (const f of files.slice(keep)) {
    rmSync(join(backupFolder, f.name))
  }
}

export async function exportProject(): Promise<string | null> {
  const project = requireProject()
  const result = await dialog.showSaveDialog({
    title: 'Экспорт проекта',
    defaultPath: `${project.name}.fgtree`,
    filters: [{ name: 'Family Geneology', extensions: ['fgtree'] }]
  })
  if (result.canceled || !result.filePath) return null
  return packProject(project.path, result.filePath, 'export')
}

export async function importProject(): Promise<ProjectMeta | null> {
  const fileResult = await dialog.showOpenDialog({
    title: 'Импорт проекта',
    filters: [{ name: 'Family Geneology', extensions: ['fgtree'] }],
    properties: ['openFile']
  })
  if (fileResult.canceled || !fileResult.filePaths[0]) return null

  const folderResult = await dialog.showOpenDialog({
    title: 'Папка для развёртывания проекта',
    properties: ['openDirectory', 'createDirectory']
  })
  if (folderResult.canceled || !folderResult.filePaths[0]) return null

  return unpackProject(fileResult.filePaths[0], folderResult.filePaths[0])
}

export async function backupProject(): Promise<string | null> {
  const project = requireProject()
  const settings = getSettings()
  const backupFolder = settings.backupFolder ?? join(project.path, 'Backups')
  mkdirSync(backupFolder, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)
  const safeName = project.name.replace(/[^a-zA-Z0-9_-]/g, '_')
  const outPath = join(backupFolder, `${safeName}_${stamp}.fgtree`)
  const result = await packProject(project.path, outPath, 'backup')
  rotateBackups(backupFolder, safeName, settings.backupKeepCount)
  return result
}

export async function restoreProject(): Promise<ProjectMeta | null> {
  const fileResult = await dialog.showOpenDialog({
    title: 'Восстановить из архива',
    filters: [{ name: 'Family Geneology', extensions: ['fgtree'] }],
    properties: ['openFile']
  })
  if (fileResult.canceled || !fileResult.filePaths[0]) return null

  const folderResult = await dialog.showOpenDialog({
    title: 'Папка для восстановления',
    properties: ['openDirectory', 'createDirectory']
  })
  if (folderResult.canceled || !folderResult.filePaths[0]) return null

  return unpackProject(fileResult.filePaths[0], folderResult.filePaths[0])
}

export async function backupOnQuitIfEnabled(): Promise<void> {
  const settings = getSettings()
  if (!settings.backupOnQuit) return
  try {
    requireProject()
    await backupProject()
  } catch {
    // no open project
  }
}

export async function handleOpenFgtreeFile(filePath: string): Promise<ProjectMeta | null> {
  const folderResult = await dialog.showOpenDialog({
    title: 'Папка для развёртывания проекта',
    properties: ['openDirectory', 'createDirectory']
  })
  if (folderResult.canceled || !folderResult.filePaths[0]) return null
  return unpackProject(filePath, folderResult.filePaths[0])
}
