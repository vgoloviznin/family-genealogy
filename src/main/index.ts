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
import { resolveAppProtocolPath } from '@shared/renderer-packaging';
import { initLogging, logError, logInfo } from './utils/log';

/** Older Intel GPUs often fail to paint Chromium with HW acceleration (blank window). */
if (process.platform === 'darwin' && process.arch === 'x64') {
  app.disableHardwareAcceleration();
}

const APP_SCHEME = 'family-app';

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

function getRendererRoot(): string {
  return join(__dirname, '../renderer');
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  },
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

function registerAppProtocol(): void {
  const root = getRendererRoot();
  protocol.handle(APP_SCHEME, (request) => {
    const filePath = resolveAppProtocolPath(root, request.url);
    if (!filePath) {
      return new Response(null, { status: 404 });
    }
    return net.fetch(pathToFileURL(filePath).href);
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#f4f1eb',
    icon: getAppIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  let shown = false;
  const showWindow = (reason: string) => {
    if (shown || !mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    shown = true;
    logInfo(`showing main window (${reason})`);
    mainWindow.show();
  };

  mainWindow.on('ready-to-show', () => showWindow('ready-to-show'));
  // ready-to-show can hang on some Intel Mac GPU stacks; do not leave the window hidden forever.
  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => showWindow('did-finish-load-fallback'), 1500);
  });
  setTimeout(() => showWindow('timeout-fallback'), 5000);

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    logError('did-fail-load', { code, desc, url });
    showWindow('did-fail-load');
  });
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    logError('render-process-gone', details);
  });
  mainWindow.webContents.on('console-message', (event) => {
    if (event.level === 'warning' || event.level === 'error') {
      logError('renderer-console', {
        level: event.level,
        message: event.message,
        line: event.lineNumber,
        sourceId: event.sourceId
      });
    }
  });

  setMenuWindow(mainWindow);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    // Custom scheme gives a real origin so Vite module scripts (and CORS) work.
    // loadFile(file://) + crossorigin = blank UI on macOS and Windows.
    void mainWindow.loadURL(`${APP_SCHEME}://localhost/index.html`);
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
    initLogging();
    logInfo('app ready', {
      platform: process.platform,
      arch: process.arch,
      electron: process.versions.electron,
      chrome: process.versions.chrome
    });
    setDockIcon();
    const locale = validateLocale(getSettings().locale);
    initAppLocale(locale);

    process.on('uncaughtException', (err) => {
      logError('uncaughtException', err);
    });
    process.on('unhandledRejection', (reason) => {
      logError('unhandledRejection', reason);
    });

    registerAppProtocol();

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
