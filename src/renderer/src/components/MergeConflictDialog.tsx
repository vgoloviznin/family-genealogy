import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MergeConflictResolution, MergePreviewResult } from '@shared/merge-types';
import { getConflictFieldDiffs, getConflictRowLabel } from '@shared/merge-conflict-fields';
import { mergeColumnLabel } from '../lib/labels';

function formatFieldValue(value: unknown, emptyLabel: string): string {
  if (value === null || value === undefined || value === '') {
    return emptyLabel;
  }
  if (typeof value === 'string') {
    return value;
  }
  return String(value);
}

export function MergeConflictDialog({
  preview,
  onCancel,
  onApply
}: {
  preview: {
    conflicts: MergePreviewResult['conflicts'];
    archivePath?: string;
    previewNoteKey?: string;
  };
  onCancel: () => void;
  onApply: (resolutions: MergeConflictResolution[]) => void;
}) {
  const { t } = useTranslation();
  const emptyFieldLabel = t('dateField.empty');
  const [choices, setChoices] = useState<Record<string, 'local' | 'remote'>>(() => {
    const initial: Record<string, 'local' | 'remote'> = {};
    for (const conflict of preview.conflicts) {
      initial[`${conflict.table}:${conflict.id}`] = 'local';
    }
    return initial;
  });

  const rows = useMemo(
    () =>
      preview.conflicts.map((conflict) => {
        const key = `${conflict.table}:${conflict.id}`;
        const fields = conflict.detail?.fields ?? getConflictFieldDiffs(conflict.table, conflict.local, conflict.remote);
        return {
          key,
          conflict,
          fields,
          label: getConflictRowLabel(conflict.table, conflict.local)
        };
      }),
    [preview.conflicts]
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl space-y-4">
        <div>
          <h2 className="text-lg font-medium">{t('mergeConflictsTitle')}</h2>
          <p className="text-sm text-stone-500 mt-1">{t('mergeConflictsHint')}</p>
          {preview.previewNoteKey ? (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2">{t(preview.previewNoteKey)}</p>
          ) : null}
        </div>

        <div className="flex-1 overflow-auto space-y-4 min-h-0">
          {rows.map(({ key, conflict, fields, label }) => (
            <div key={key} className="border border-stone-200 rounded-lg p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium text-sm text-stone-800">{label}</div>
                  <div className="text-xs text-stone-500">
                    {conflict.table} · {conflict.id}
                  </div>
                </div>
                <div className="flex gap-3 text-sm">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`choice-${key}`}
                      checked={choices[key] === 'local'}
                      onChange={() => setChoices((prev) => ({ ...prev, [key]: 'local' }))}
                    />
                    {t('mergeMyVersion')}
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`choice-${key}`}
                      checked={choices[key] === 'remote'}
                      onChange={() => setChoices((prev) => ({ ...prev, [key]: 'remote' }))}
                    />
                    {t('mergeTheirVersion')}
                  </label>
                </div>
              </div>

              {fields.length === 0 ? (
                <p className="text-xs text-stone-500">{t('mergeNoFieldDiffs')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="text-left text-stone-500 border-b border-stone-200">
                        <th className="py-1 pr-2 font-medium">{t('mergeField')}</th>
                        <th className="py-1 px-2 font-medium">{t('mergeMyVersion')}</th>
                        <th className="py-1 pl-2 font-medium">{t('mergeTheirVersion')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((field) => (
                        <tr key={field.column} className="border-b border-stone-100 align-top">
                          <td className="py-1.5 pr-2 text-stone-600 whitespace-nowrap">{mergeColumnLabel(field.column)}</td>
                          <td className={`py-1.5 px-2 break-all ${choices[key] === 'local' ? 'bg-stone-50 font-medium' : ''}`}>
                            {formatFieldValue(field.local, emptyFieldLabel)}
                          </td>
                          <td className={`py-1.5 pl-2 break-all ${choices[key] === 'remote' ? 'bg-stone-50 font-medium' : ''}`}>
                            {formatFieldValue(field.remote, emptyFieldLabel)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button className="px-4 py-2 rounded border" onClick={onCancel}>
            {t('cancel')}
          </button>
          <button
            className="px-4 py-2 rounded bg-stone-800 text-white"
            onClick={() => {
              const resolutions: MergeConflictResolution[] = preview.conflicts.map((c) => ({
                table: c.table,
                id: c.id,
                choice: choices[`${c.table}:${c.id}`] ?? 'local'
              }));
              onApply(resolutions);
            }}
          >
            {t('mergeApplySync')}
          </button>
        </div>
      </div>
    </div>
  );
}
