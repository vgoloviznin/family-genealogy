import { mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, vi } from 'vitest';
import { initAppLocale } from '@main/i18n';

initAppLocale('ru');

afterEach(() => {
  initAppLocale('ru');
});

const userDataDir = join(tmpdir(), 'fgtree-test-userdata');
mkdirSync(userDataDir, { recursive: true });

vi.mock('electron', () => ({
  app: {
    getVersion: () => '0.1.0-test',
    getPath: (name: string) => (name === 'userData' ? userDataDir : tmpdir())
  },
  BrowserWindow: {
    getAllWindows: () => [],
    getFocusedWindow: () => null
  },
  dialog: {
    showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })),
    showSaveDialog: vi.fn(async () => ({ canceled: true, filePath: undefined })),
    showMessageBox: vi.fn(async () => ({ response: 0 }))
  },
  Menu: {
    setApplicationMenu: vi.fn(),
    buildFromTemplate: vi.fn(() => ({}))
  },
  nativeImage: {
    createFromPath: () => ({ isEmpty: () => true }),
    createEmpty: () => ({ isEmpty: () => true })
  },
  shell: {
    openExternal: vi.fn(async () => undefined),
    openPath: vi.fn(async () => '')
  }
}));
