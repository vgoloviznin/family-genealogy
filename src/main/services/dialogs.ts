import { getAppLocale, localizedError, t } from '../i18n';

export type ConfirmDialogOptions = {
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

export async function showConfirm(options: ConfirmDialogOptions): Promise<boolean> {
  const { dialog, BrowserWindow } = await import('electron');
  const win = BrowserWindow.getFocusedWindow();
  const locale = getAppLocale();
  const cancelLabel = options.cancelLabel ?? t(locale, 'cancel');
  const confirmLabel = options.confirmLabel ?? (options.destructive ? t(locale, 'delete') : t(locale, 'ok'));
  const messageBoxOptions = {
    type: options.destructive ? ('warning' as const) : ('question' as const),
    buttons: [cancelLabel, confirmLabel],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
    message: options.message,
    detail: options.detail
  };
  const { response } = win ? await dialog.showMessageBox(win, messageBoxOptions) : await dialog.showMessageBox(messageBoxOptions);
  return response === 1;
}

export async function pickFolder(title?: string): Promise<string | null> {
  const { dialog } = await import('electron');
  const locale = getAppLocale();
  const result = await dialog.showOpenDialog({
    title: title ?? t(locale, 'backupFolder'),
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths[0]) {
    return null;
  }
  return result.filePaths[0];
}

export { localizedError };
