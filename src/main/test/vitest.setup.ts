import { mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { vi } from 'vitest'

const userDataDir = join(tmpdir(), 'fgtree-test-userdata')
mkdirSync(userDataDir, { recursive: true })

vi.mock('electron', () => ({
  app: {
    getVersion: () => '0.1.0-test',
    getPath: (name: string) => (name === 'userData' ? userDataDir : tmpdir())
  },
  BrowserWindow: {
    getAllWindows: () => []
  },
  dialog: {
    showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })),
    showSaveDialog: vi.fn(async () => ({ canceled: true, filePath: undefined }))
  },
  nativeImage: {
    createFromPath: () => ({ isEmpty: () => true }),
    createEmpty: () => ({ isEmpty: () => true })
  }
}))
