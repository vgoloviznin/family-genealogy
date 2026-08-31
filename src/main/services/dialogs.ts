import { dialog, BrowserWindow } from 'electron';

export type ConfirmDialogOptions = {
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

export async function showConfirm(options: ConfirmDialogOptions): Promise<boolean> {
  const win = BrowserWindow.getFocusedWindow();
  const cancelLabel = options.cancelLabel ?? 'Отмена';
  const confirmLabel = options.confirmLabel ?? (options.destructive ? 'Удалить' : 'OK');
  const { response } = await dialog.showMessageBox(win ?? undefined, {
    type: options.destructive ? 'warning' : 'question',
    buttons: [cancelLabel, confirmLabel],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
    message: options.message,
    detail: options.detail
  });
  return response === 1;
}

export async function pickFolder(title = 'Папка бэкапов'): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title,
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths[0]) {
    return null;
  }
  return result.filePaths[0];
}
