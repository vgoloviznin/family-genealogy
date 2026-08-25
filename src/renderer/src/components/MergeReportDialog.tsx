import { useTranslation } from 'react-i18next';
import type { BatchMergeApplyResult, MergeApplyResult, MergeableTable, MergeTableStats } from '@shared/merge-types';

function sumStat(stats: Partial<Record<MergeableTable, MergeTableStats>>, key: keyof MergeTableStats): number {
  return Object.values(stats).reduce((sum, table) => sum + (table?.[key] ?? 0), 0);
}

function isBatchResult(result: MergeApplyResult | BatchMergeApplyResult): result is BatchMergeApplyResult {
  return 'archives' in result && Array.isArray(result.archives);
}

export function MergeReportDialog({ result, onClose }: { result: MergeApplyResult | BatchMergeApplyResult; onClose: () => void }) {
  const { t } = useTranslation();
  const batch = isBatchResult(result);
  const stats = batch ? result.totalStats : result.stats;
  const inserted = sumStat(stats, 'inserted');
  const updated = sumStat(stats, 'tookRemote');
  const conflictsResolved = result.conflictsResolved;
  const mediaCopied = result.mediaCopied;
  const backupPath = result.backupPath ?? null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl">
        <h2 className="text-lg font-medium">{batch ? t('mergeBatchReportTitle') : t('mergeReportTitle')}</h2>
        <ul className="text-sm space-y-2 text-stone-700">
          {batch ? (
            <li>
              {t('mergeBatchArchives')}: <span className="font-medium">{result.archives.length}</span>
            </li>
          ) : null}
          <li>
            {t('mergeAdded')}: <span className="font-medium">{inserted}</span>
          </li>
          <li>
            {t('mergeUpdated')}: <span className="font-medium">{updated}</span>
          </li>
          <li>
            {t('mergeConflictsResolved')}: <span className="font-medium">{conflictsResolved}</span>
          </li>
          <li>
            {t('mergeMediaCopied')}: <span className="font-medium">{mediaCopied}</span>
          </li>
          {backupPath ? (
            <li className="break-all">
              {t('mergeBackup')}: <span className="font-medium">{backupPath}</span>
            </li>
          ) : null}
        </ul>
        <div className="flex justify-end">
          <button className="px-4 py-2 rounded bg-stone-800 text-white" onClick={onClose}>
            {t('mergeClose')}
          </button>
        </div>
      </div>
    </div>
  );
}
