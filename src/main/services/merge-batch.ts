import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { checkpointDatabase, getDatabasePath } from '../db/connection';
import { requireProject } from './project';
import { clearUndo } from './undo';
import { mergeIncomingDatabase } from './merge';
import { applySyncFromArchivePath, backupProject, extractArchiveToTemp, emitPackProgress, verifyExtractedArchive } from './pack';
import { readPackManifest } from '@shared/pack-manifest';
import type {
  BatchMergeApplyResult,
  BatchMergeArchivePreview,
  BatchMergePreviewResult,
  MergeableTable,
  MergeApplyResult,
  MergeConflict,
  MergeConflictResolution,
  MergeTableStats
} from '@shared/merge-types';
import { getAppLocale, localizedError, t } from '../i18n';

function emptyStats(): MergeTableStats {
  return { inserted: 0, keptLocal: 0, tookRemote: 0, conflicts: 0 };
}

function addStats(into: Partial<Record<MergeableTable, MergeTableStats>>, from: Partial<Record<MergeableTable, MergeTableStats>> | undefined): void {
  if (!from) {
    return;
  }
  for (const [table, stats] of Object.entries(from) as Array<[MergeableTable, MergeTableStats]>) {
    if (!stats) {
      continue;
    }
    const target = into[table] ?? emptyStats();
    target.inserted += stats.inserted;
    target.keptLocal += stats.keptLocal;
    target.tookRemote += stats.tookRemote;
    target.conflicts += stats.conflicts;
    into[table] = target;
  }
}

function copyProjectSnapshot(sourcePath: string): string {
  const sourceDb = join(sourcePath, 'family.sqlite');
  if (getDatabasePath() === sourceDb) {
    checkpointDatabase();
  }

  const dest = mkdtempSync(join(tmpdir(), 'fgtree-batch-master-'));
  copyFileSync(join(sourcePath, 'project.json'), join(dest, 'project.json'));
  if (!existsSync(sourceDb)) {
    throw new Error(localizedError('errors.projectNoDb'));
  }
  copyFileSync(sourceDb, join(dest, 'family.sqlite'));

  for (const dir of ['media', 'thumbs'] as const) {
    const src = join(sourcePath, dir);
    if (existsSync(src)) {
      cpSync(src, join(dest, dir), { recursive: true });
    } else {
      mkdirSync(join(dest, dir), { recursive: true });
    }
  }
  return dest;
}

interface ArchiveSortMeta {
  archivePath: string;
  exportedAt: string | null;
  mtime: number;
}

/** Sort by manifest exportedAt ASC, then mtime, then path. */
export async function sortArchivePaths(archivePaths: string[]): Promise<string[]> {
  const metas: ArchiveSortMeta[] = [];
  for (const archivePath of archivePaths) {
    if (!existsSync(archivePath)) {
      throw new Error(localizedError('errors.archiveFileNotFound', { path: archivePath }));
    }
    let tempDir: string | null = null;
    try {
      tempDir = await extractArchiveToTemp(archivePath);
      const manifest = readPackManifest(join(tempDir, 'manifest.json'), getAppLocale());
      metas.push({
        archivePath,
        exportedAt: manifest.exportedAt ?? null,
        mtime: statSync(archivePath).mtimeMs
      });
    } finally {
      if (tempDir) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    }
  }

  metas.sort((a, b) => {
    if (a.exportedAt && b.exportedAt && a.exportedAt !== b.exportedAt) {
      return a.exportedAt < b.exportedAt ? -1 : 1;
    }
    if (a.exportedAt && !b.exportedAt) {
      return -1;
    }
    if (!a.exportedAt && b.exportedAt) {
      return 1;
    }
    if (a.mtime !== b.mtime) {
      return a.mtime - b.mtime;
    }
    return a.archivePath.localeCompare(b.archivePath);
  });

  return metas.map((m) => m.archivePath);
}

/**
 * Preview merging several archives into a temp copy of the open project.
 * Unresolved conflicts are applied as «remote» so later archives see an advanced master.
 * The real local project is never written.
 */
export async function previewBatchSync(archivePaths: string[]): Promise<BatchMergePreviewResult> {
  const project = requireProject();
  if (archivePaths.length === 0) {
    throw new Error(localizedError('errors.archivesNotSelected'));
  }

  const sorted = await sortArchivePaths(archivePaths);
  const tempMaster = copyProjectSnapshot(project.path);
  const archives: BatchMergeArchivePreview[] = [];
  const allConflictsMap = new Map<string, MergeConflict>();
  const totalStats: Partial<Record<MergeableTable, MergeTableStats>> = {};

  try {
    for (let i = 0; i < sorted.length; i++) {
      const archivePath = sorted[i];
      let tempIncoming: string | null = null;
      try {
        emitPackProgress({
          phase: 'merge',
          current: i,
          total: sorted.length,
          message: t(getAppLocale(), 'progress.comparingArchive', { current: i + 1, total: sorted.length })
        });
        tempIncoming = await extractArchiveToTemp(archivePath);
        const manifest = await verifyExtractedArchive(tempIncoming);
        if (manifest.projectId !== project.projectId) {
          throw new Error(localizedError('errors.wrongProjectArchive'));
        }

        const preview = await mergeIncomingDatabase({
          mode: 'preview',
          localProjectPath: tempMaster,
          incomingProjectPath: tempIncoming
        });
        if ('applied' in preview) {
          throw new Error(localizedError('errors.expectedPreviewGotApply'));
        }

        for (const conflict of preview.conflicts) {
          allConflictsMap.set(`${conflict.table}:${conflict.id}`, conflict);
        }
        addStats(totalStats, preview.stats);

        archives.push({
          archivePath,
          order: i,
          exportedAt: manifest.exportedAt,
          editorLabel: manifest.editorLabel,
          sourceDeviceId: manifest.sourceDeviceId,
          stats: preview.stats,
          conflicts: preview.conflicts
        });

        const chainResolutions: MergeConflictResolution[] = preview.conflicts.map((c) => ({
          table: c.table,
          id: c.id,
          choice: 'remote'
        }));

        await mergeIncomingDatabase({
          mode: 'apply',
          localProjectPath: tempMaster,
          incomingProjectPath: tempIncoming,
          resolutions: chainResolutions
        });
      } finally {
        if (tempIncoming) {
          rmSync(tempIncoming, { recursive: true, force: true });
        }
      }
    }

    emitPackProgress({
      phase: 'merge',
      current: sorted.length,
      total: sorted.length,
      message: t(getAppLocale(), 'progress.done')
    });

    const allConflicts = [...allConflictsMap.values()];
    return {
      archivePaths: sorted,
      archives,
      allConflicts,
      unresolvedConflicts: allConflicts.length,
      previewNoteKey: 'mergeBatchPreviewNote',
      totalStats
    };
  } finally {
    rmSync(tempMaster, { recursive: true, force: true });
  }
}

/**
 * Apply several archives in sorted order with one autobackup.
 * Resolutions are keyed by table+id; each merge only uses entries that conflict in that step.
 */
export async function applyBatchSync(archivePaths: string[], resolutions: MergeConflictResolution[]): Promise<BatchMergeApplyResult> {
  requireProject();
  if (archivePaths.length === 0) {
    throw new Error(localizedError('errors.archivesNotSelected'));
  }

  const sorted = await sortArchivePaths(archivePaths);
  const backupPath = await backupProject();
  if (!backupPath) {
    throw new Error(localizedError('errors.backupFailed'));
  }

  const archiveResults: MergeApplyResult[] = [];
  const totalStats: Partial<Record<MergeableTable, MergeTableStats>> = {};
  let conflictsResolved = 0;
  let mediaCopied = 0;
  let mediaSkipped = 0;

  try {
    for (let i = 0; i < sorted.length; i++) {
      emitPackProgress({
        phase: 'merge',
        current: i,
        total: sorted.length,
        message: t(getAppLocale(), 'progress.mergingArchive', { current: i + 1, total: sorted.length })
      });
      const result = await applySyncFromArchivePath(sorted[i], resolutions, {
        createBackup: false,
        clearUndoAfter: false,
        backupPath
      });
      archiveResults.push(result);
      addStats(totalStats, result.stats);
      conflictsResolved += result.conflictsResolved;
      mediaCopied += result.mediaCopied;
      mediaSkipped += result.mediaSkipped;
    }

    emitPackProgress({
      phase: 'merge',
      current: sorted.length,
      total: sorted.length,
      message: t(getAppLocale(), 'progress.done')
    });
  } finally {
    clearUndo();
  }

  return {
    backupPath,
    archives: archiveResults,
    totalStats,
    conflictsResolved,
    mediaCopied,
    mediaSkipped
  };
}
