import type { MergeableTable, MergeRowInput, MergeRowRecord, MergeRowResult } from './merge-types';
import { MERGEABLE_COLUMNS } from './merge-types';

export type { MergeableTable, MergeRowInput, MergeRowRecord, MergeRowResult, RowDecision } from './merge-types';
export { MERGE_TABLE_ORDER, MERGEABLE_COLUMNS } from './merge-types';

function normalizeFingerprintValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  return value;
}

/** Stable content fingerprint; null and undefined compare as equal. */
export function rowFingerprint(table: MergeableTable, row: MergeRowRecord): string {
  const columns = MERGEABLE_COLUMNS[table];
  return columns
    .map((column) => {
      const value = normalizeFingerprintValue(row[column]);
      return JSON.stringify(value);
    })
    .join('\u0001');
}

function fingerprintsEqual(table: MergeableTable, a: MergeRowRecord, b: MergeRowRecord): boolean {
  return rowFingerprint(table, a) === rowFingerprint(table, b);
}

function updatedAtOf(row: MergeRowRecord): string {
  const value = row.updated_at;
  return typeof value === 'string' ? value : '';
}

function isDeleted(row: MergeRowRecord): boolean {
  const deletedAt = row.deleted_at;
  return deletedAt !== null && deletedAt !== undefined && deletedAt !== '';
}

function rowId(row: MergeRowRecord): string {
  return typeof row.id === 'string' ? row.id : String(row.id ?? '');
}

/**
 * media_links have no updated_at — tombstone preference only, never conflict.
 */
export function decideMediaLinkMerge(input: { local?: MergeRowRecord | null; remote?: MergeRowRecord | null }): MergeRowResult {
  const { local, remote } = input;

  if (!local && remote) {
    return { decision: 'insert-remote', winner: remote };
  }
  if (local && !remote) {
    return { decision: 'keep-local', winner: local };
  }
  if (!local && !remote) {
    return { decision: 'keep-local', winner: null };
  }

  const localRow = local!;
  const remoteRow = remote!;

  if (isDeleted(remoteRow) && !isDeleted(localRow)) {
    return { decision: 'take-remote', winner: remoteRow };
  }
  if (isDeleted(localRow) && !isDeleted(remoteRow)) {
    return { decision: 'keep-local', winner: localRow };
  }

  return { decision: 'keep-local', winner: localRow };
}

/**
 * Last-write-wins by updated_at ISO strings.
 * Conflict only when updated_at is equal and content differs (winner null).
 */
export function decideRowMerge(input: MergeRowInput): MergeRowResult {
  const { table, local, remote } = input;

  if (table === 'media_links') {
    return decideMediaLinkMerge({ local, remote });
  }

  if (!local && remote) {
    return { decision: 'insert-remote', winner: remote };
  }
  if (local && !remote) {
    return { decision: 'keep-local', winner: local };
  }
  if (!local && !remote) {
    return { decision: 'keep-local', winner: null };
  }

  const localRow = local!;
  const remoteRow = remote!;

  if (fingerprintsEqual(table, localRow, remoteRow)) {
    return { decision: 'keep-local', winner: localRow };
  }

  const localUpdated = updatedAtOf(localRow);
  const remoteUpdated = updatedAtOf(remoteRow);

  if (remoteUpdated > localUpdated) {
    return { decision: 'take-remote', winner: remoteRow };
  }
  if (localUpdated > remoteUpdated) {
    return { decision: 'keep-local', winner: localRow };
  }

  return {
    decision: 'conflict',
    winner: null,
    conflict: {
      table,
      id: rowId(localRow) || rowId(remoteRow),
      local: localRow,
      remote: remoteRow
    }
  };
}

export function resolveConflict(local: MergeRowRecord, remote: MergeRowRecord, choice: 'local' | 'remote'): MergeRowRecord {
  return choice === 'local' ? local : remote;
}
