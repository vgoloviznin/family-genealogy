import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export function PromptDialog({
  title,
  label,
  defaultValue,
  onCancel,
  onSubmit
}: {
  title: string;
  label: string;
  defaultValue: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl">
        <h2 className="text-lg font-medium">{title}</h2>
        <label className="block text-sm">
          {label}
          <input
            className="w-full border rounded px-2 py-1 mt-1"
            value={value}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && value.trim()) {
                onSubmit(value.trim());
              }
            }}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button className="px-4 py-2 rounded border" onClick={onCancel}>
            {t('cancel')}
          </button>
          <button
            className="px-4 py-2 rounded bg-stone-800 text-white disabled:opacity-50"
            disabled={!value.trim()}
            onClick={() => onSubmit(value.trim())}
          >
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
