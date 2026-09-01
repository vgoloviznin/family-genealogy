import { createHash } from 'crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'fs';
import { basename, dirname, extname, join } from 'path';
import { tmpdir } from 'os';
import type Database from 'better-sqlite3';
import { checkpointDatabase, getDatabasePath, getSqlite, openStandaloneDatabase } from '../db/connection';
import { SCHEMA_VERSION } from '../db/schema';
import { getProjectJson } from './project';
import { decideMediaLinkMerge, decideRowMerge, resolveConflict } from '@shared/merge-rules';
import { applyPlaceRemapToRows, planPlaceMerge } from '@shared/merge-places';
import { getConflictFieldDiffs } from '@shared/merge-conflict-fields';
import {
  MERGE_TABLE_ORDER,
  type MergeableTable,
  type MergeApplyResult,
  type MergeConflict,
  type MergeConflictResolution,
  type MergePreviewResult,
  type MergeRowRecord,
  type MergeTableStats,
  type RowDecision
} from '@shared/merge-types';
import { localizedError } from '../i18n';

/** Preview payload from DB merge; pack layer adds archivePath. */
export type MergeDatabasePreview = Omit<MergePreviewResult, 'archivePath'>;

const SKIP_COPY_NAMES = new Set(['family.sqlite', 'project.json']);

export interface MergeIncomingOptions {
  localProjectPath: string;
  incomingProjectPath: string;
  mode: 'preview' | 'apply';
  resolutions?: MergeConflictResolution[];
  backupPath?: string | null;
}

interface PendingWrite {
  table: MergeableTable;
  row: MergeRowRecord;
}

interface DeferredPrimaryPhoto {
  id: string;
  primary_photo_id: unknown;
}

function emptyStats(): MergeTableStats {
  return { inserted: 0, keptLocal: 0, tookRemote: 0, conflicts: 0 };
}

function bumpStats(stats: MergeTableStats, decision: RowDecision): void {
  switch (decision) {
    case 'insert-remote':
      stats.inserted++;
      break;
    case 'keep-local':
      stats.keptLocal++;
      break;
    case 'take-remote':
      stats.tookRemote++;
      break;
    case 'conflict':
      stats.conflicts++;
      break;
  }
}

function rowId(row: MergeRowRecord): string {
  return typeof row.id === 'string' ? row.id : String(row.id ?? '');
}

function loadTable(db: Database.Database, table: MergeableTable): MergeRowRecord[] {
  return db.prepare(`SELECT * FROM ${table}`).all() as MergeRowRecord[];
}

function indexById(rows: MergeRowRecord[]): Map<string, MergeRowRecord> {
  return new Map(rows.map((row) => [rowId(row), row]));
}

/**
 * Open the merge target DB. Uses the global connection when it already points at
 * localProjectPath; otherwise opens a standalone connection so batch preview can
 * mutate a temp master without switching the open project.
 */
function openLocalMergeTarget(localProjectPath: string): {
  sqlite: Database.Database;
  checkpoint: () => void;
  cleanup: () => void;
} {
  if (!existsSync(join(localProjectPath, 'project.json'))) {
    throw new Error(localizedError('errors.notAProject'));
  }
  const expected = join(localProjectPath, 'family.sqlite');
  if (!existsSync(expected)) {
    throw new Error(localizedError('errors.projectNoDb'));
  }

  if (getDatabasePath() === expected) {
    return {
      sqlite: getSqlite(),
      checkpoint: () => checkpointDatabase(),
      cleanup: () => {}
    };
  }

  const sqlite = openStandaloneDatabase(expected);
  return {
    sqlite,
    checkpoint: () => {
      sqlite.pragma('wal_checkpoint(TRUNCATE)');
    },
    cleanup: () => {
      try {
        sqlite.close();
      } catch {
        /* already closed */
      }
    }
  };
}

function openIncomingCopy(incomingProjectPath: string): { db: Database.Database; cleanup: () => void } {
  const incomingDb = join(incomingProjectPath, 'family.sqlite');
  if (!existsSync(incomingDb)) {
    throw new Error(localizedError('errors.invalidArchiveNoDb'));
  }
  const tempDir = mkdtempSync(join(tmpdir(), 'fgtree-merge-in-'));
  const tempDb = join(tempDir, 'family.sqlite');
  copyFileSync(incomingDb, tempDb);
  const db = openStandaloneDatabase(tempDb);
  return {
    db,
    cleanup: () => {
      try {
        db.close();
      } catch {
        /* already closed */
      }
      rmSync(tempDir, { recursive: true, force: true });
    }
  };
}

function upsertRow(sqlite: Database.Database, table: MergeableTable, row: MergeRowRecord): void {
  const info = sqlite.pragma(`table_info(${table})`) as Array<{ name: string }>;
  const cols = info.map((c) => c.name).filter((name) => Object.prototype.hasOwnProperty.call(row, name));
  if (cols.length === 0 || !cols.includes('id')) {
    throw new Error(localizedError('errors.invalidRow', { table }));
  }
  const placeholders = cols.map(() => '?').join(', ');
  const updates = cols
    .filter((c) => c !== 'id')
    .map((c) => `${c} = excluded.${c}`)
    .join(', ');
  const sql =
    updates.length > 0
      ? `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`
      : `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT(id) DO NOTHING`;
  sqlite.prepare(sql).run(...cols.map((c) => (row[c] === undefined ? null : row[c])));
}

function assertNoOrphans(sqlite: Database.Database): void {
  const checks: Array<{ label: string; sql: string }> = [
    {
      label: 'family_partners',
      sql: `SELECT COUNT(*) AS n FROM family_partners fp
        LEFT JOIN people p ON p.id = fp.person_id
        LEFT JOIN families f ON f.id = fp.family_id
        WHERE p.id IS NULL OR f.id IS NULL`
    },
    {
      label: 'family_children',
      sql: `SELECT COUNT(*) AS n FROM family_children fc
        LEFT JOIN people p ON p.id = fc.person_id
        LEFT JOIN families f ON f.id = fc.family_id
        WHERE p.id IS NULL OR f.id IS NULL`
    },
    {
      label: 'events',
      sql: `SELECT COUNT(*) AS n FROM events e
        LEFT JOIN people p ON e.person_id IS NOT NULL AND p.id = e.person_id
        LEFT JOIN families f ON e.family_id IS NOT NULL AND f.id = e.family_id
        LEFT JOIN places pl ON e.place_id IS NOT NULL AND pl.id = e.place_id
        WHERE (e.person_id IS NOT NULL AND p.id IS NULL)
           OR (e.family_id IS NOT NULL AND f.id IS NULL)
           OR (e.place_id IS NOT NULL AND pl.id IS NULL)`
    },
    {
      label: 'citations',
      sql: `SELECT COUNT(*) AS n FROM citations c
        LEFT JOIN sources s ON s.id = c.source_id
        WHERE s.id IS NULL`
    },
    {
      label: 'media_links',
      sql: `SELECT COUNT(*) AS n FROM media_links ml
        LEFT JOIN media_assets m ON m.id = ml.media_id
        WHERE m.id IS NULL`
    }
  ];

  for (const check of checks) {
    const row = sqlite.prepare(check.sql).get() as { n: number };
    if (row.n > 0) {
      throw new Error(localizedError('errors.brokenRefs', { label: check.label }));
    }
  }
}

function placeRemapRecord(remap: Map<string, string>): Record<string, string> | undefined {
  if (remap.size === 0) {
    return undefined;
  }
  return Object.fromEntries(remap.entries());
}

function hashFileContents(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function isDeleted(row: MergeRowRecord): boolean {
  const deletedAt = row.deleted_at;
  return deletedAt !== null && deletedAt !== undefined && deletedAt !== '';
}

function strField(row: MergeRowRecord, key: string): string | null {
  const v = row[key];
  if (v == null || v === '') {
    return null;
  }
  return typeof v === 'string' ? v : String(v);
}

function isSafeRelativeMediaPath(relativePath: string): boolean {
  if (!relativePath || relativePath.includes('..')) {
    return false;
  }
  const normalized = relativePath.replace(/\\/g, '/');
  const top = normalized.split('/')[0];
  if (SKIP_COPY_NAMES.has(basename(normalized))) {
    return false;
  }
  return top === 'media' || top === 'thumbs';
}

/** Collect content hashes already present locally (DB rows + files under media/). */
function collectLocalContentHashes(localProjectPath: string, localMediaRows: MergeRowRecord[]): Set<string> {
  const hashes = new Set<string>();
  for (const row of localMediaRows) {
    const hash = strField(row, 'content_hash');
    if (hash) {
      hashes.add(hash);
    }
  }

  const mediaDir = join(localProjectPath, 'media');
  if (!existsSync(mediaDir)) {
    return hashes;
  }
  for (const name of readdirSync(mediaDir)) {
    if (name.startsWith('.')) {
      continue;
    }
    const full = join(mediaDir, name);
    try {
      hashes.add(hashFileContents(full));
    } catch {
      /* skip unreadable */
    }
  }
  return hashes;
}

function alternateMediaRelativePath(row: MergeRowRecord): string {
  const id = rowId(row);
  const fileName = strField(row, 'file_name');
  if (fileName) {
    return join('media', `${id}_${basename(fileName)}`);
  }
  const relative = strField(row, 'relative_path') ?? '';
  const ext = extname(relative) || '.bin';
  return join('media', `${id}${ext}`);
}

function pathOccupiedByOtherHash(localProjectPath: string, relativePath: string, expectedHash: string): boolean {
  const full = join(localProjectPath, relativePath);
  if (!existsSync(full)) {
    return false;
  }
  try {
    return hashFileContents(full) !== expectedHash;
  } catch {
    return true;
  }
}

interface MediaCopyPlanResult {
  mediaCopied: number;
  mediaSkipped: number;
  /** id → new relative_path when collision forced a rename */
  pathUpdates: Map<string, string>;
}

/**
 * Plan (and optionally apply) copying of media/thumbs for non-deleted media_assets winners.
 * Counts only main media files toward mediaCopied/mediaSkipped; thumbs are best-effort.
 */
function planOrCopyMediaFiles(input: {
  localProjectPath: string;
  incomingProjectPath: string;
  localMediaRows: MergeRowRecord[];
  candidates: MergeRowRecord[];
  apply: boolean;
}): MediaCopyPlanResult {
  const { localProjectPath, incomingProjectPath, localMediaRows, candidates, apply } = input;
  const knownHashes = collectLocalContentHashes(localProjectPath, localMediaRows);
  let mediaCopied = 0;
  let mediaSkipped = 0;
  const pathUpdates = new Map<string, string>();

  for (const row of candidates) {
    if (isDeleted(row)) {
      continue;
    }

    const contentHash = strField(row, 'content_hash');
    const relativePath = strField(row, 'relative_path');
    if (!contentHash || !relativePath || !isSafeRelativeMediaPath(relativePath)) {
      mediaSkipped++;
      continue;
    }

    const incomingFile = join(incomingProjectPath, relativePath);
    if (!existsSync(incomingFile)) {
      mediaSkipped++;
      continue;
    }

    if (knownHashes.has(contentHash)) {
      mediaSkipped++;
    } else {
      let destRelative = relativePath;
      if (pathOccupiedByOtherHash(localProjectPath, relativePath, contentHash)) {
        destRelative = alternateMediaRelativePath(row);
        pathUpdates.set(rowId(row), destRelative);
      }

      if (apply) {
        const destFull = join(localProjectPath, destRelative);
        mkdirSync(dirname(destFull), { recursive: true });
        copyFileSync(incomingFile, destFull);
      }
      knownHashes.add(contentHash);
      mediaCopied++;
    }

    const thumbRel = strField(row, 'thumb_relative_path');
    if (thumbRel && isSafeRelativeMediaPath(thumbRel)) {
      const incomingThumb = join(incomingProjectPath, thumbRel);
      const localThumb = join(localProjectPath, thumbRel);
      if (existsSync(incomingThumb) && !existsSync(localThumb)) {
        if (apply) {
          mkdirSync(dirname(localThumb), { recursive: true });
          copyFileSync(incomingThumb, localThumb);
        }
      }
    }
  }

  return { mediaCopied, mediaSkipped, pathUpdates };
}

function applyMediaPathUpdates(sqlite: Database.Database, pathUpdates: Map<string, string>): void {
  if (pathUpdates.size === 0) {
    return;
  }
  const stmt = sqlite.prepare('UPDATE media_assets SET relative_path = ? WHERE id = ?');
  for (const [id, relativePath] of pathUpdates) {
    stmt.run(relativePath, id);
  }
}

/**
 * Preview or apply merge of an unpacked incoming project into the open local project.
 * After media_assets row merge, copies media/thumbs files (or counts them in preview).
 */
function enrichConflict(conflict: MergeConflict): MergeConflict {
  return {
    ...conflict,
    detail: {
      ...conflict.detail,
      fields: getConflictFieldDiffs(conflict.table, conflict.local, conflict.remote)
    }
  };
}

/** Preview or apply merge of an unpacked incoming project into the open local project. */
export async function mergeIncomingDatabase(options: MergeIncomingOptions): Promise<MergeDatabasePreview | MergeApplyResult> {
  const { localProjectPath, incomingProjectPath, mode, resolutions = [], backupPath = null } = options;

  if (!existsSync(join(incomingProjectPath, 'project.json'))) {
    throw new Error(localizedError('errors.invalidArchiveNoProject'));
  }

  const localMeta = getProjectJson(localProjectPath);
  const incomingMeta = getProjectJson(incomingProjectPath);

  if (incomingMeta.projectId !== localMeta.projectId) {
    throw new Error(localizedError('errors.wrongProjectArchive'));
  }
  if (incomingMeta.schemaVersion > SCHEMA_VERSION) {
    throw new Error(localizedError('errors.archiveNewerVersion'));
  }

  const localTarget = openLocalMergeTarget(localProjectPath);
  const incoming = openIncomingCopy(incomingProjectPath);
  try {
    const localSqlite = localTarget.sqlite;
    const remoteSqlite = incoming.db;

    const localTables = Object.fromEntries(MERGE_TABLE_ORDER.map((table) => [table, loadTable(localSqlite, table)])) as Record<
      MergeableTable,
      MergeRowRecord[]
    >;

    const remoteTables = Object.fromEntries(MERGE_TABLE_ORDER.map((table) => [table, loadTable(remoteSqlite, table)])) as Record<
      MergeableTable,
      MergeRowRecord[]
    >;

    const placePlan = planPlaceMerge({
      localPlaces: localTables.places,
      remotePlaces: remoteTables.places
    });

    remoteTables.events = applyPlaceRemapToRows(remoteTables.events, placePlan.remap);

    const resolutionMap = new Map<string, 'local' | 'remote'>(resolutions.map((r) => [`${r.table}:${r.id}`, r.choice]));

    const stats: Partial<Record<MergeableTable, MergeTableStats>> = {};
    const conflicts: MergeConflict[] = [];
    const pendingWrites: PendingWrite[] = [];
    const deferredPhotos: DeferredPrimaryPhoto[] = [];
    const mediaCandidates: MergeRowRecord[] = [];
    let conflictsResolved = 0;

    const ensureTableStats = (table: MergeableTable): MergeTableStats => {
      if (!stats[table]) {
        stats[table] = emptyStats();
      }
      return stats[table]!;
    };

    const noteMediaCandidate = (table: MergeableTable, winner: MergeRowRecord) => {
      if (table === 'media_assets' && !isDeleted(winner)) {
        mediaCandidates.push(winner);
      }
    };

    const queueWinner = (table: MergeableTable, winner: MergeRowRecord, local: MergeRowRecord | null) => {
      noteMediaCandidate(table, winner);
      if (table === 'people') {
        const id = rowId(winner);
        deferredPhotos.push({ id, primary_photo_id: winner.primary_photo_id ?? null });
        pendingWrites.push({
          table,
          row: {
            ...winner,
            primary_photo_id: local?.primary_photo_id ?? null
          }
        });
        return;
      }
      pendingWrites.push({ table, row: winner });
    };

    const handleDecision = (input: {
      table: MergeableTable;
      decision: RowDecision;
      winner: MergeRowRecord | null;
      conflict?: MergeConflict;
      local: MergeRowRecord | null;
    }) => {
      const { table, decision, winner, conflict, local } = input;
      const tableStats = ensureTableStats(table);

      if (decision === 'conflict' && conflict) {
        const key = `${conflict.table}:${conflict.id}`;
        const choice = resolutionMap.get(key);
        if (choice) {
          const resolved = resolveConflict(conflict.local, conflict.remote, choice);
          conflictsResolved++;
          const resolvedDecision: RowDecision = choice === 'local' ? 'keep-local' : 'take-remote';
          bumpStats(tableStats, resolvedDecision);
          if (choice === 'remote') {
            if (mode === 'apply') {
              queueWinner(table, resolved, local);
            } else {
              noteMediaCandidate(table, resolved);
            }
          }
          return;
        }
        bumpStats(tableStats, 'conflict');
        conflicts.push(enrichConflict(conflict));
        return;
      }

      bumpStats(tableStats, decision);
      if (decision === 'insert-remote' || decision === 'take-remote') {
        if (winner) {
          if (mode === 'apply') {
            queueWinner(table, winner, local);
          } else {
            noteMediaCandidate(table, winner);
          }
        }
      }
    };

    // Places via planPlaceMerge
    for (const action of placePlan.actions) {
      const local = action.localId != null ? (localTables.places.find((p) => rowId(p) === action.localId) ?? null) : null;
      handleDecision({
        table: 'places',
        decision: action.decision,
        winner: action.winner,
        conflict: action.conflict,
        local
      });
    }

    for (const table of MERGE_TABLE_ORDER) {
      if (table === 'places') {
        continue;
      }

      const localById = indexById(localTables[table]);
      const remoteRows = remoteTables[table];

      for (const remote of remoteRows) {
        const id = rowId(remote);
        const local = localById.get(id) ?? null;
        const result = table === 'media_links' ? decideMediaLinkMerge({ local, remote }) : decideRowMerge({ table, local, remote });

        handleDecision({
          table,
          decision: result.decision,
          winner: result.winner,
          conflict: result.conflict,
          local
        });
      }
    }

    if (mode === 'apply') {
      if (conflicts.length > 0) {
        throw new Error(localizedError('errors.unresolvedConflicts'));
      }

      const applyTx = localSqlite.transaction(() => {
        for (const write of pendingWrites) {
          upsertRow(localSqlite, write.table, write.row);
        }
        for (const photo of deferredPhotos) {
          localSqlite.prepare('UPDATE people SET primary_photo_id = ? WHERE id = ?').run(photo.primary_photo_id, photo.id);
        }
        assertNoOrphans(localSqlite);
      });
      applyTx();

      const mediaResult = planOrCopyMediaFiles({
        localProjectPath,
        incomingProjectPath,
        localMediaRows: localTables.media_assets,
        candidates: mediaCandidates,
        apply: true
      });
      if (mediaResult.pathUpdates.size > 0) {
        applyMediaPathUpdates(localSqlite, mediaResult.pathUpdates);
      }
      localTarget.checkpoint();

      return {
        applied: true,
        projectId: localMeta.projectId,
        conflictsResolved,
        stats,
        mediaCopied: mediaResult.mediaCopied,
        mediaSkipped: mediaResult.mediaSkipped,
        placeRemap: placeRemapRecord(placePlan.remap),
        backupPath
      } satisfies MergeApplyResult;
    }

    const mediaPreview = planOrCopyMediaFiles({
      localProjectPath,
      incomingProjectPath,
      localMediaRows: localTables.media_assets,
      candidates: mediaCandidates,
      apply: false
    });

    return {
      projectId: localMeta.projectId,
      conflicts,
      stats,
      mediaCopied: mediaPreview.mediaCopied,
      mediaSkipped: mediaPreview.mediaSkipped,
      placeRemap: placeRemapRecord(placePlan.remap),
      backupPath
    } satisfies MergeDatabasePreview;
  } finally {
    incoming.cleanup();
    localTarget.cleanup();
  }
}
