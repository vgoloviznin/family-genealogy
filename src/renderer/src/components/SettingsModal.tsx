import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppLocale, AppSettings } from '@shared/types';
import { LocaleSelect } from './LocaleSelect';

export function SettingsModal({
  settings,
  locale,
  onLocaleChange,
  projectName,
  onClose,
  onSave
}: {
  settings: AppSettings;
  locale: AppLocale;
  onLocaleChange: (locale: AppLocale) => void;
  projectName: string;
  onClose: () => void;
  onSave: (partial: Partial<AppSettings>, projectName: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(projectName);
  const [backupFolder, setBackupFolder] = useState(settings.backupFolder ?? '');
  const [backupOnQuit, setBackupOnQuit] = useState(settings.backupOnQuit);
  const [backupKeepCount, setBackupKeepCount] = useState(settings.backupKeepCount);
  const [editorLabel, setEditorLabel] = useState(settings.editorLabel);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-medium">{t('settings')}</h2>
        <LocaleSelect value={locale} onChange={onLocaleChange} />
        <label className="block text-sm">
          {t('projectName')}
          <input className="w-full border rounded px-2 py-1 mt-1" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block text-sm">
          {t('editorLabel')}
          <input className="w-full border rounded px-2 py-1 mt-1" value={editorLabel} onChange={(e) => setEditorLabel(e.target.value)} />
        </label>
        <label className="block text-sm">
          {t('backupFolder')}
          <div className="flex gap-2 mt-1">
            <input
              className="flex-1 border rounded px-2 py-1"
              value={backupFolder}
              onChange={(e) => setBackupFolder(e.target.value)}
              placeholder={t('backupFolderPlaceholder')}
            />
            <button
              className="border rounded px-2 text-sm"
              onClick={() => {
                void window.api.settings.pickFolder().then((p) => {
                  if (p) {
                    setBackupFolder(p);
                  }
                });
              }}
            >
              …
            </button>
          </div>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={backupOnQuit} onChange={(e) => setBackupOnQuit(e.target.checked)} />
          {t('backupOnQuit')}
        </label>
        <label className="block text-sm">
          {t('backupKeepCount')}
          <input
            type="number"
            min={1}
            max={50}
            className="w-full border rounded px-2 py-1 mt-1"
            value={backupKeepCount}
            onChange={(e) => setBackupKeepCount(Number(e.target.value))}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button className="px-4 py-2 rounded border" onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            className="px-4 py-2 rounded bg-stone-800 text-white disabled:opacity-50"
            disabled={!name.trim()}
            onClick={() => void onSave({ backupFolder: backupFolder || undefined, backupOnQuit, backupKeepCount, editorLabel }, name)}
          >
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
