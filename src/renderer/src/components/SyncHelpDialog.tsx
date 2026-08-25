import { useTranslation } from 'react-i18next';

export function SyncHelpDialog({ editorLabel, onClose }: { editorLabel?: string; onClose: () => void }) {
  const { t } = useTranslation();
  const showEditorReminder = !editorLabel?.trim();

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-medium">{t('syncHelpTitle')}</h2>
        {showEditorReminder ? (
          <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-2">{t('syncHelpEditorReminder')}</p>
        ) : null}
        <ol className="list-decimal list-inside text-sm space-y-2 text-stone-700">
          <li>{t('syncHelpStep1')}</li>
          <li>{t('syncHelpStep2')}</li>
          <li>{t('syncHelpStep3')}</li>
          <li>{t('syncHelpStep4')}</li>
          <li>{t('syncHelpStep5')}</li>
          <li>{t('syncHelpStep6')}</li>
          <li>{t('syncHelpStep7')}</li>
        </ol>
        <div className="flex justify-end">
          <button className="px-4 py-2 rounded bg-stone-800 text-white" onClick={onClose}>
            {t('mergeClose')}
          </button>
        </div>
      </div>
    </div>
  );
}
