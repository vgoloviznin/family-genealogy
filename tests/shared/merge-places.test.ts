import { describe, expect, it } from 'vitest';
import { applyPlaceRemapToRows, buildLocalPlaceIndex, planPlaceMerge } from '@shared/merge-places';

function place(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pl1',
    name: 'Moscow',
    normalized_name: 'moscow',
    deleted_at: null,
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('buildLocalPlaceIndex', () => {
  it('maps normalized_name to local id among non-deleted', () => {
    const index = buildLocalPlaceIndex([
      place({ id: 'b', normalized_name: 'paris' }),
      place({ id: 'a', normalized_name: 'paris' }),
      place({ id: 'gone', normalized_name: 'paris', deleted_at: '2024-01-02T00:00:00.000Z' }),
      place({ id: 'c', normalized_name: 'rome' })
    ]);
    expect(index.get('paris')).toBe('a');
    expect(index.get('rome')).toBe('c');
    expect(index.size).toBe(2);
  });
});

describe('planPlaceMerge', () => {
  it('merges by id when remote id already exists locally', () => {
    const local = place({ id: 'pl1', name: 'Old', updated_at: '2024-01-01T00:00:00.000Z' });
    const remote = place({
      id: 'pl1',
      name: 'New',
      updated_at: '2024-06-01T00:00:00.000Z'
    });
    const plan = planPlaceMerge({ localPlaces: [local], remotePlaces: [remote] });
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]).toMatchObject({
      decision: 'take-remote',
      remoteId: 'pl1',
      localId: 'pl1'
    });
    expect(plan.remap.size).toBe(0);
  });

  it('remaps same normalized_name without inserting remote id', () => {
    const local = place({
      id: 'local-1',
      name: 'Moscow',
      normalized_name: 'moscow',
      updated_at: '2024-01-01T00:00:00.000Z'
    });
    const remote = place({
      id: 'remote-9',
      name: 'Москва',
      normalized_name: 'moscow',
      updated_at: '2024-06-01T00:00:00.000Z'
    });
    const plan = planPlaceMerge({ localPlaces: [local], remotePlaces: [remote] });

    expect(plan.remap.get('remote-9')).toBe('local-1');
    expect(plan.actions[0].decision).toBe('take-remote');
    expect(plan.actions[0].localId).toBe('local-1');
    expect(plan.actions[0].winner).toMatchObject({
      id: 'local-1',
      name: 'Москва'
    });
    expect(plan.actions.some((a) => a.decision === 'insert-remote')).toBe(false);
  });

  it('conflicts on local id when remapped content differs at equal updated_at', () => {
    const local = place({
      id: 'local-1',
      name: 'Moscow',
      normalized_name: 'moscow',
      updated_at: '2024-03-01T00:00:00.000Z'
    });
    const remote = place({
      id: 'remote-9',
      name: 'Moskva',
      normalized_name: 'moscow',
      updated_at: '2024-03-01T00:00:00.000Z'
    });
    const plan = planPlaceMerge({ localPlaces: [local], remotePlaces: [remote] });

    expect(plan.actions[0].decision).toBe('conflict');
    expect(plan.actions[0].winner).toBeNull();
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0]).toMatchObject({
      table: 'places',
      id: 'local-1'
    });
    expect(plan.remap.get('remote-9')).toBe('local-1');
  });

  it('inserts remote when no id or name match', () => {
    const local = place({ id: 'local-1', normalized_name: 'moscow' });
    const remote = place({ id: 'remote-2', name: 'Paris', normalized_name: 'paris' });
    const plan = planPlaceMerge({ localPlaces: [local], remotePlaces: [remote] });
    expect(plan.actions[0]).toMatchObject({
      decision: 'insert-remote',
      remoteId: 'remote-2',
      localId: null,
      winner: remote
    });
    expect(plan.remap.size).toBe(0);
  });

  it('keeps local when remapped fingerprints match', () => {
    const local = place({
      id: 'local-1',
      name: 'Moscow',
      normalized_name: 'moscow',
      updated_at: '2024-01-01T00:00:00.000Z'
    });
    const remote = place({
      id: 'remote-9',
      name: 'Moscow',
      normalized_name: 'moscow',
      updated_at: '2025-01-01T00:00:00.000Z'
    });
    const plan = planPlaceMerge({ localPlaces: [local], remotePlaces: [remote] });
    expect(plan.actions[0].decision).toBe('keep-local');
    expect(plan.actions[0].winner).toBe(local);
    expect(plan.remap.get('remote-9')).toBe('local-1');
  });
});

describe('applyPlaceRemapToRows', () => {
  it('rewrites place_id using remap', () => {
    const remap = new Map([['remote-9', 'local-1']]);
    const rows = [
      { id: 'e1', place_id: 'remote-9', type: 'birth' },
      { id: 'e2', place_id: 'other', type: 'death' },
      { id: 'e3', place_id: null, type: 'other' }
    ];
    const out = applyPlaceRemapToRows(rows, remap);
    expect(out[0].place_id).toBe('local-1');
    expect(out[1].place_id).toBe('other');
    expect(out[2].place_id).toBeNull();
  });
});
