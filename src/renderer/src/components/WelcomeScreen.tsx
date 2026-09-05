import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppLocale, AppSettings, RecentProject } from '@shared/types';
import { normalizeRecentProjects } from '@shared/recents';
import { LocaleSelect } from './LocaleSelect';
import { canCompleteOnboarding } from '../lib/onboarding';

interface Props {
  locale: AppLocale;
  onLocaleChange: (locale: AppLocale) => void;
  settings: AppSettings | null;
  onboardingRequired: boolean;
  onCompleteOnboarding: (partial: Partial<AppSettings>) => Promise<void>;
  recents: RecentProject[];
  onCreate: (name: string) => void;
  onOpen: () => void;
  onImport: () => void;
  onOpenRecent: (path: string) => void;
}

export function WelcomeScreen({
  locale,
  onLocaleChange,
  settings,
  onboardingRequired,
  onCompleteOnboarding,
  recents,
  onCreate,
  onOpen,
  onImport,
  onOpenRecent
}: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState(t('defaultProjectName'));
  const nameEdited = useRef(false);
  const items = normalizeRecentProjects(recents);
  const [editorLabel, setEditorLabel] = useState(settings?.editorLabel ?? '');
  const [backupFolder, setBackupFolder] = useState(settings?.backupFolder ?? '');
  const [onboardingError, setOnboardingError] = useState('');

  useEffect(() => {
    if (!nameEdited.current) {
      setName(t('defaultProjectName'));
    }
  }, [t]);

  useEffect(() => {
    setEditorLabel(settings?.editorLabel ?? '');
    setBackupFolder(settings?.backupFolder ?? '');
  }, [settings?.editorLabel, settings?.backupFolder]);

  useEffect(() => {
    if (settings?.backupFolder?.trim()) {
      return;
    }
    void window.api.settings.getDefaultBackupFolder().then((folder) => {
      setBackupFolder((current) => current || folder);
    });
  }, [settings?.backupFolder]);

  if (onboardingRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f4f1eb] to-[#e8e0d4] p-8">
        <div className="max-w-lg w-full bg-white/90 rounded-2xl shadow-lg p-8 border border-stone-200 space-y-4">
          <h1 className="text-3xl font-serif text-stone-800">{t('onboardingTitle')}</h1>
          <p className="text-stone-500">{t('onboardingSubtitle')}</p>
          <LocaleSelect value={locale} onChange={onLocaleChange} />
          <label className="block text-sm text-stone-600">
            {t('editorLabel')}
            <input className="w-full border border-stone-300 rounded-lg px-3 py-2 mt-1" value={editorLabel} onChange={(e) => setEditorLabel(e.target.value)} />
          </label>
          <label className="block text-sm text-stone-600">
            {t('backupFolder')}
            <div className="flex gap-2 mt-1">
              <input
                className="flex-1 border border-stone-300 rounded-lg px-3 py-2"
                value={backupFolder}
                onChange={(e) => setBackupFolder(e.target.value)}
                placeholder={t('backupFolderPlaceholder')}
              />
              <button
                type="button"
                className="border rounded-lg px-3 py-2 text-sm"
                onClick={() => {
                  void window.api.settings.pickFolder().then((folder) => {
                    if (folder) {
                      setBackupFolder(folder);
                    }
                  });
                }}
              >
                …
              </button>
            </div>
          </label>
          {onboardingError ? <p className="text-sm text-red-700">{onboardingError}</p> : null}
          <button
            type="button"
            className="w-full bg-stone-800 text-white rounded-lg py-2.5 hover:bg-stone-700"
            onClick={() => {
              if (!editorLabel.trim()) {
                setOnboardingError(t('editorLabelRequired'));
                return;
              }
              if (!backupFolder.trim()) {
                setOnboardingError(t('backupFolderRequired'));
                return;
              }
              if (!canCompleteOnboarding(editorLabel, backupFolder)) {
                setOnboardingError(t('errors.onboardingRequired'));
                return;
              }
              setOnboardingError('');
              void onCompleteOnboarding({ editorLabel: editorLabel.trim(), backupFolder: backupFolder.trim() });
            }}
          >
            {t('onboardingContinue')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f4f1eb] to-[#e8e0d4] p-8">
      <div className="max-w-lg w-full bg-white/90 rounded-2xl shadow-lg p-8 border border-stone-200">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif text-stone-800 mb-1">{t('appTitle')}</h1>
            <p className="text-stone-500">{t('welcomeSubtitle')}</p>
          </div>
          <div className="w-40 shrink-0">
            <LocaleSelect value={locale} onChange={onLocaleChange} />
          </div>
        </div>

        {items.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 mb-3">{t('recentProjects')}</h2>
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.path}>
                  <button
                    type="button"
                    className="w-full text-left rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 hover:border-stone-400 hover:bg-white transition-colors"
                    onClick={() => onOpenRecent(item.path)}
                    title={item.path}
                  >
                    <div className="font-medium text-stone-900 text-base leading-snug truncate">{item.name}</div>
                    <div className="text-xs text-stone-500 mt-1 truncate">{item.path}</div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <label className="block text-sm text-stone-600 mb-1">{t('projectName')}</label>
        <input
          className="w-full border border-stone-300 rounded-lg px-3 py-2 mb-4"
          value={name}
          onChange={(e) => {
            nameEdited.current = true;
            setName(e.target.value);
          }}
        />

        <div className="flex flex-col gap-2">
          <button className="bg-stone-800 text-white rounded-lg py-2.5 hover:bg-stone-700" onClick={() => onCreate(name)}>
            {t('createProject')}
          </button>
          <button className="border border-stone-300 rounded-lg py-2.5 hover:bg-stone-50" onClick={onOpen}>
            {t('openProject')}
          </button>
          <button className="border border-stone-300 rounded-lg py-2.5 hover:bg-stone-50" onClick={onImport}>
            {t('importProject')}
          </button>
        </div>
      </div>
    </div>
  );
}
