import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { closeDatabase, openDatabase } from '../db/connection'
import { SCHEMA_VERSION } from '../db/schema'
import { newId } from '../utils/id'

export interface TestProject {
  path: string
  cleanup: () => void
}

export function createTestProjectFiles(name = 'Test Project'): TestProject {
  const path = mkdtempSync(join(tmpdir(), 'fgtree-test-'))
  writeFileSync(
    join(path, 'project.json'),
    JSON.stringify({
      projectId: newId(),
      name,
      schemaVersion: SCHEMA_VERSION,
      createdAt: '2020-01-01T00:00:00.000Z'
    }),
    'utf-8'
  )
  mkdirSync(join(path, 'media'), { recursive: true })
  mkdirSync(join(path, 'thumbs'), { recursive: true })
  return {
    path,
    cleanup: () => rmSync(path, { recursive: true, force: true })
  }
}

export function createTestProjectDir(name = 'Test Project'): TestProject {
  const project = createTestProjectFiles(name)
  openDatabase(project.path)
  return {
    path: project.path,
    cleanup: () => {
      closeDatabase()
      project.cleanup()
    }
  }
}

export function createEmptyDir(prefix = 'fgtree-empty-'): string {
  return mkdtempSync(join(tmpdir(), prefix))
}

export function removeDir(path: string): void {
  rmSync(path, { recursive: true, force: true })
}
