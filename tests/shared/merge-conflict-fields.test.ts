import { describe, expect, it } from 'vitest';
import { getConflictFieldDiffs, getConflictRowLabel } from '@shared/merge-conflict-fields';
import { mergeColumnLabelKey } from '@shared/locales';

describe('merge-conflict-fields', () => {
  it('labels people as «Фамилия Имя»', () => {
    expect(
      getConflictRowLabel('people', {
        id: 'p1',
        first_name: 'Иван',
        last_name: 'Иванов'
      })
    ).toBe('Иванов Иван');
  });

  it('falls back to table:id for non-people rows', () => {
    expect(getConflictRowLabel('events', { id: 'e1', type: 'birth' })).toBe('events:e1');
  });

  it('returns merge column label keys', () => {
    expect(mergeColumnLabelKey('first_name')).toBe('merge.column.first_name');
    expect(mergeColumnLabelKey('notes')).toBe('merge.column.notes');
  });

  it('diffs only changed mergeable columns', () => {
    const local = {
      id: 'p1',
      first_name: 'Ann',
      last_name: 'Smith',
      middle_name: null,
      maiden_name: null,
      sex: 'unknown',
      is_living: 1,
      notes: 'local',
      primary_photo_id: null,
      deleted_at: null,
      updated_at: '2024-01-01T00:00:00.000Z'
    };
    const remote = {
      ...local,
      notes: 'remote',
      first_name: 'Anne'
    };
    const diffs = getConflictFieldDiffs('people', local, remote);
    expect(diffs).toEqual([
      { column: 'first_name', local: 'Ann', remote: 'Anne' },
      { column: 'notes', local: 'local', remote: 'remote' }
    ]);
  });

  it('treats null and undefined as equal', () => {
    const local = {
      id: 'p1',
      first_name: 'A',
      last_name: 'B',
      middle_name: null,
      maiden_name: null,
      sex: 'unknown',
      is_living: 1,
      notes: null,
      primary_photo_id: null,
      deleted_at: null
    };
    const remote = { ...local, notes: undefined };
    expect(getConflictFieldDiffs('people', local, remote)).toEqual([]);
  });
});
