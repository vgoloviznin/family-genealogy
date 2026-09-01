import { app, BrowserWindow, protocol, net, nativeImage, shell, ipcMain } from 'electron';
import { join } from 'path';
import { pathToFileURL } from 'url';
import iconPng from '../../resources/icon.png?asset';
import { registerIpcHandlers } from './ipc/register';
import { resolveMediaPath } from './services/media';
import { backupOnQuitIfEnabled, handleOpenFgtreeFile } from './services/pack';
import { closeProject } from './services/project';
import { getSettings } from './services/settings';
import { initAppLocale } from './i18n';
import { applyAppLocale } from './locale';
import { setMenuWindow } from './menu';
import { IPC_CHANNELS } from '@shared/types';
import { validateLocale } from '@shared/locales';

let mainWindow: BrowserWindow | null = null;
let cachedAppIcon: Electron.NativeImage | null = null;

function getAppIcon(): Electron.NativeImage {
  if (!cachedAppIcon) {
    cachedAppIcon = nativeImage.createFromPath(iconPng);
    if (cachedAppIcon.isEmpty()) {
      cachedAppIcon = nativeImage.createEmpty();
    }
  }
  return cachedAppIcon;
}

function setDockIcon(): void {
  if (process.platform !== 'darwin') {
    return;
  }
  const icon = getAppIcon();
  if (icon.isEmpty()) {
    return;
  }
  try {
    app.dock?.setIcon(icon);
  } catch {
    // Dev mode uses PNG; packaged .app icon comes from Info.plist.
  }
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'family-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    icon: getAppIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.on('ready-to-show', () => mainWindow?.show());
  setMenuWindow(mainWindow);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

function rebuildMenu(): void {
  applyAppLocale(getSettings().locale);
}

export { mainWindow };

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const fgtree = argv.find((a) => a.endsWith('.fgtree'));
    if (fgtree && mainWindow) {
      handleOpenFgtreeFile(fgtree).then((meta) => {
        if (meta) {
          mainWindow?.webContents.send('project:opened', meta);
        }
      });
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    setDockIcon();
    const locale = validateLocale(getSettings().locale);
    initAppLocale(locale);

    protocol.handle('family-media', (request) => {
      const url = new URL(request.url);
      const relative = decodeURIComponent(url.pathname.slice(1));
      const filePath = resolveMediaPath(relative);
      if (!filePath) {
        return new Response(null, { status: 404 });
      }
      return net.fetch(pathToFileURL(filePath).toString());
    });

    registerIpcHandlers();
    rebuildMenu();
    createWindow();

    const fgtreeArg = process.argv.find((a) => a.endsWith('.fgtree'));
    if (fgtreeArg) {
      handleOpenFgtreeFile(fgtreeArg).then((meta) => {
        if (meta) {
          mainWindow?.webContents.send('project:opened', meta);
        }
      });
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  let quitting = false;
  let prepareQuitResolve: ((proceed: boolean) => void) | null = null;

  ipcMain.on(IPC_CHANNELS.APP_PREPARE_QUIT_DONE, (_event, proceed: boolean) => {
    prepareQuitResolve?.(proceed);
    prepareQuitResolve = null;
  });

  function requestRendererPrepareQuit(): Promise<boolean> {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      prepareQuitResolve = resolve;
      mainWindow!.webContents.send(IPC_CHANNELS.APP_PREPARE_QUIT);
      setTimeout(() => {
        if (prepareQuitResolve) {
          prepareQuitResolve(true);
          prepareQuitResolve = null;
        }
      }, 10000);
    });
  }

  app.on('before-quit', (e) => {
    if (quitting) {
      return;
    }
    e.preventDefault();
    void requestRendererPrepareQuit().then((proceed) => {
      if (!proceed) {
        return;
      }
      quitting = true;
      void backupOnQuitIfEnabled()
        .catch(() => undefined)
        .finally(() => {
          closeProject();
          app.exit(0);
        });
    });
  });

  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    if (filePath.endsWith('.fgtree')) {
      handleOpenFgtreeFile(filePath).then((meta) => {
        if (meta) {
          mainWindow?.webContents.send('project:opened', meta);
        }
      });
    }
  });
}
