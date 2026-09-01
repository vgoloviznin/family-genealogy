import type { MergeableTable, MergeConflictField, MergeRowRecord } from './merge-types';
import { MERGEABLE_COLUMNS } from './merge-types';

function asString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

/** Human-readable row title for conflict list. */
export function getConflictRowLabel(table: MergeableTable, row: MergeRowRecord): string {
  if (table === 'people') {
    const last = asString(row.last_name);
    const first = asString(row.first_name);
    const name = [last, first].filter(Boolean).join(' ').trim();
    if (name) {
      return name;
    }
  }
  const id = typeof row.id === 'string' ? row.id : String(row.id ?? '');
  return `${table}:${id}`;
}

function normalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  return value;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalizeValue(a)) === JSON.stringify(normalizeValue(b));
}

/** Diff of MERGEABLE_COLUMNS that differ between local and remote. */
export function getConflictFieldDiffs(table: MergeableTable, local: MergeRowRecord, remote: MergeRowRecord): MergeConflictField[] {
  const fields: MergeConflictField[] = [];
  for (const column of MERGEABLE_COLUMNS[table]) {
    const localValue = local[column];
    const remoteValue = remote[column];
    if (!valuesEqual(localValue, remoteValue)) {
      fields.push({ column, local: localValue, remote: remoteValue });
    }
  }
  return fields;
}
