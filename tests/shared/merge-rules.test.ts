import { describe, expect, it } from 'vitest';
import { decideMediaLinkMerge, decideRowMerge, resolveConflict, rowFingerprint } from '@shared/merge-rules';
import { MERGEABLE_COLUMNS, MERGE_TABLE_ORDER } from '@shared/merge-types';

function person(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    first_name: 'Ann',
    last_name: 'Smith',
    middle_name: null,
    maiden_name: null,
    sex: 'female',
    is_living: 1,
    notes: null,
    primary_photo_id: null,
    deleted_at: null,
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('MERGE_TABLE_ORDER / MERGEABLE_COLUMNS', () => {
  it('lists tables in dependency order without app_meta', () => {
    expect(MERGE_TABLE_ORDER[0]).toBe('places');
    expect(MERGE_TABLE_ORDER).toContain('media_links');
    expect(MERGE_TABLE_ORDER).not.toContain('app_meta');
  });

  it('excludes audit timestamp columns from fingerprints', () => {
    for (const cols of Object.values(MERGEABLE_COLUMNS)) {
      expect(cols).not.toContain('updated_at');
      expect(cols).not.toContain('updated_by_device_id');
      expect(cols).not.toContain('updated_by_label');
    }
  });
});

describe('rowFingerprint', () => {
  it('treats null and undefined as equal', () => {
    const a = person({ notes: null, middle_name: undefined });
    const b = person({ notes: undefined, middle_name: null });
    expect(rowFingerprint('people', a)).toBe(rowFingerprint('people', b));
  });

  it('ignores updated_at differences', () => {
    const a = person({ updated_at: '2024-01-01T00:00:00.000Z' });
    const b = person({ updated_at: '2025-01-01T00:00:00.000Z' });
    expect(rowFingerprint('people', a)).toBe(rowFingerprint('people', b));
  });
});

describe('decideRowMerge', () => {
  it('inserts when only remote exists', () => {
    const remote = person();
    expect(decideRowMerge({ table: 'people', local: null, remote })).toEqual({
      decision: 'insert-remote',
      winner: remote
    });
  });

  it('keeps local when only local exists', () => {
    const local = person();
    expect(decideRowMerge({ table: 'people', local, remote: null })).toEqual({
      decision: 'keep-local',
      winner: local
    });
  });

  it('keeps local when fingerprints match', () => {
    const local = person({ updated_at: '2024-01-01T00:00:00.000Z' });
    const remote = person({
      notes: null,
      updated_at: '2025-06-01T00:00:00.000Z',
      updated_by_device_id: 'other'
    });
    expect(decideRowMerge({ table: 'people', local, remote })).toEqual({
      decision: 'keep-local',
      winner: local
    });
  });

  it('takes remote when remote updated_at is newer', () => {
    const local = person({ notes: 'old', updated_at: '2024-01-01T00:00:00.000Z' });
    const remote = person({ notes: 'new', updated_at: '2024-06-01T00:00:00.000Z' });
    expect(decideRowMerge({ table: 'people', local, remote })).toEqual({
      decision: 'take-remote',
      winner: remote
    });
  });

  it('keeps local when local updated_at is newer', () => {
    const local = person({ notes: 'local', updated_at: '2024-06-01T00:00:00.000Z' });
    const remote = person({ notes: 'remote', updated_at: '2024-01-01T00:00:00.000Z' });
    expect(decideRowMerge({ table: 'people', local, remote })).toEqual({
      decision: 'keep-local',
      winner: local
    });
  });

  it('conflicts with winner null when updated_at equal and content differs', () => {
    const local = person({ notes: 'A', updated_at: '2024-03-01T00:00:00.000Z' });
    const remote = person({ notes: 'B', updated_at: '2024-03-01T00:00:00.000Z' });
    const result = decideRowMerge({ table: 'people', local, remote });
    expect(result.decision).toBe('conflict');
    expect(result.winner).toBeNull();
    expect(result.conflict).toMatchObject({
      table: 'people',
      id: 'p1',
      local,
      remote
    });
  });

  it('tombstone vs edit: newer updated_at wins', () => {
    const local = person({
      deleted_at: null,
      notes: 'still here',
      updated_at: '2024-01-01T00:00:00.000Z'
    });
    const remote = person({
      deleted_at: '2024-05-01T00:00:00.000Z',
      notes: 'still here',
      updated_at: '2024-05-01T00:00:00.000Z'
    });
    expect(decideRowMerge({ table: 'people', local, remote }).decision).toBe('take-remote');

    const localTomb = person({
      deleted_at: '2024-06-01T00:00:00.000Z',
      updated_at: '2024-06-01T00:00:00.000Z'
    });
    const remoteEdit = person({
      deleted_at: null,
      notes: 'revived',
      updated_at: '2024-02-01T00:00:00.000Z'
    });
    expect(decideRowMerge({ table: 'people', local: localTomb, remote: remoteEdit }).decision).toBe('keep-local');
  });
});

describe('decideMediaLinkMerge', () => {
  const link = (overrides: Record<string, unknown> = {}) => ({
    id: 'ml1',
    media_id: 'm1',
    person_id: 'p1',
    event_id: null,
    deleted_at: null,
    ...overrides
  });

  it('inserts when no local', () => {
    const remote = link();
    expect(decideMediaLinkMerge({ local: null, remote })).toEqual({
      decision: 'insert-remote',
      winner: remote
    });
  });

  it('takes remote tombstone when local is active', () => {
    const local = link({ deleted_at: null });
    const remote = link({ deleted_at: '2024-01-01T00:00:00.000Z' });
    expect(decideMediaLinkMerge({ local, remote })).toEqual({
      decision: 'take-remote',
      winner: remote
    });
  });

  it('keeps local tombstone when remote is active', () => {
    const local = link({ deleted_at: '2024-01-01T00:00:00.000Z' });
    const remote = link({ deleted_at: null });
    expect(decideMediaLinkMerge({ local, remote })).toEqual({
      decision: 'keep-local',
      winner: local
    });
  });

  it('keeps local otherwise and never conflicts', () => {
    const local = link({ person_id: 'p1' });
    const remote = link({ person_id: 'p2' });
    expect(decideMediaLinkMerge({ local, remote })).toEqual({
      decision: 'keep-local',
      winner: local
    });
    expect(decideRowMerge({ table: 'media_links', local, remote }).decision).toBe('keep-local');
  });
});

describe('resolveConflict', () => {
  it('returns the chosen side', () => {
    const local = person({ notes: 'L' });
    const remote = person({ notes: 'R' });
    expect(resolveConflict(local, remote, 'local')).toBe(local);
    expect(resolveConflict(local, remote, 'remote')).toBe(remote);
  });
});
