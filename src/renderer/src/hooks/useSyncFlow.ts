import { useCallback, useState } from 'react';
import type {
  MergeApplyResult,
  BatchMergeApplyResult,
  MergeConflictResolution,
  MergePreviewResult,
  BatchMergePreviewResult
} from '@shared/merge-types';

type SyncPreviewState = { kind: 'single'; preview: MergePreviewResult } | { kind: 'batch'; preview: BatchMergePreviewResult } | null;

export function useSyncFlow(options: {
  flushThen: (next: () => void | Promise<void>) => Promise<void>;
  refreshAfterSync: () => Promise<void>;
  showToast: (message: string, variant?: 'info' | 'error', duration?: number) => void;
}) {
  const { flushThen, refreshAfterSync, showToast } = options;
  const [syncPreview, setSyncPreview] = useState<SyncPreviewState>(null);
  const [mergeReport, setMergeReport] = useState<MergeApplyResult | BatchMergeApplyResult | null>(null);
  const [syncHelpOpen, setSyncHelpOpen] = useState(false);

  const handleSync = useCallback(async () => {
    await flushThen(async () => {
      try {
        const preview = await window.api.pack.previewSyncFromArchive();
        if (!preview) {
          return;
        }
        if (preview.conflicts.length === 0) {
          const result = await window.api.pack.applySyncFromArchive(preview.archivePath, []);
          setMergeReport(result);
          await refreshAfterSync();
          return;
        }
        setSyncPreview({ kind: 'single', preview });
      } catch (e) {
        showToast((e as Error).message, 'error');
      }
    });
  }, [refreshAfterSync, flushThen, showToast]);

  const handleSyncBatch = useCallback(async () => {
    await flushThen(async () => {
      try {
        const preview = await window.api.pack.previewSyncFromArchives();
        if (!preview) {
          return;
        }
        if (preview.allConflicts.length === 0) {
          const result = await window.api.pack.applySyncFromArchives(preview.archivePaths, []);
          setMergeReport(result);
          await refreshAfterSync();
          return;
        }
        setSyncPreview({ kind: 'batch', preview });
      } catch (e) {
        showToast((e as Error).message, 'error');
      }
    });
  }, [refreshAfterSync, flushThen, showToast]);

  const handleApplySyncResolutions = useCallback(
    async (resolutions: MergeConflictResolution[]) => {
      if (!syncPreview) {
        return;
      }
      const pending = syncPreview;
      setSyncPreview(null);
      try {
        if (pending.kind === 'single') {
          const result = await window.api.pack.applySyncFromArchive(pending.preview.archivePath, resolutions);
          setMergeReport(result);
          await refreshAfterSync();
          return;
        }
        const result = await window.api.pack.applySyncFromArchives(pending.preview.archivePaths, resolutions);
        setMergeReport(result);
        await refreshAfterSync();
      } catch (e) {
        showToast((e as Error).message, 'error');
      }
    },
    [refreshAfterSync, showToast, syncPreview]
  );

  return {
    syncPreview,
    mergeReport,
    syncHelpOpen,
    setSyncHelpOpen,
    setSyncPreview,
    setMergeReport,
    handleSync,
    handleSyncBatch,
    handleApplySyncResolutions
  };
}
