import { Menu, BrowserWindow, type MenuItemConstructorOptions } from 'electron';
import type { AppLocale } from '@shared/types';
import { t } from './i18n';

let mainWindow: BrowserWindow | null = null;

export function setMenuWindow(win: BrowserWindow | null): void {
  mainWindow = win;
}

export function buildMenu(locale: AppLocale): void {
  const isDev = Boolean(process.env.ELECTRON_RENDERER_URL);
  const template: MenuItemConstructorOptions[] = [
    {
      label: t(locale, 'menu.file'),
      submenu: [
        {
          label: t(locale, 'menu.createProject'),
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('menu:command', 'createProject')
        },
        {
          label: t(locale, 'menu.openProject'),
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send('menu:command', 'openProject')
        },
        { type: 'separator' },
        { label: t(locale, 'menu.import'), click: () => mainWindow?.webContents.send('menu:command', 'import') },
        { label: t(locale, 'menu.sync'), click: () => mainWindow?.webContents.send('menu:command', 'sync') },
        { label: t(locale, 'menu.syncBatch'), click: () => mainWindow?.webContents.send('menu:command', 'syncBatch') },
        { label: t(locale, 'menu.export'), click: () => mainWindow?.webContents.send('menu:command', 'export') },
        { label: t(locale, 'menu.backup'), click: () => mainWindow?.webContents.send('menu:command', 'backup') },
        { label: t(locale, 'menu.restore'), click: () => mainWindow?.webContents.send('menu:command', 'restore') },
        { type: 'separator' },
        { role: 'quit', label: t(locale, 'menu.quit') }
      ]
    },
    {
      label: t(locale, 'menu.edit'),
      submenu: [
        { label: t(locale, 'menu.undo'), accelerator: 'CmdOrCtrl+Z', click: () => mainWindow?.webContents.send('menu:command', 'undo') },
        { label: t(locale, 'menu.cut'), role: 'cut' },
        { label: t(locale, 'menu.copy'), role: 'copy' },
        { label: t(locale, 'menu.paste'), role: 'paste' },
        { label: t(locale, 'menu.selectAll'), role: 'selectAll' }
      ]
    },
    {
      label: t(locale, 'menu.view'),
      submenu: [
        ...(isDev
          ? ([
              { label: t(locale, 'menu.reload'), role: 'reload' },
              { label: t(locale, 'menu.toggleDevTools'), role: 'toggleDevTools' },
              { type: 'separator' }
            ] as MenuItemConstructorOptions[])
          : []),
        { label: t(locale, 'menu.resetZoom'), role: 'resetZoom' },
        { label: t(locale, 'menu.zoomIn'), role: 'zoomIn' },
        { label: t(locale, 'menu.zoomOut'), role: 'zoomOut' }
      ]
    },
    {
      label: t(locale, 'menu.help'),
      submenu: [
        {
          label: t(locale, 'menu.syncHelp'),
          click: () => mainWindow?.webContents.send('menu:command', 'syncHelp')
        },
        {
          label: t(locale, 'menu.copyDiagnostics'),
          click: () => mainWindow?.webContents.send('menu:command', 'copyDiagnostics')
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
