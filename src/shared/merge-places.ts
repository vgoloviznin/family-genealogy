import { decideRowMerge } from './merge-rules';
import type { MergeConflict, MergeRowRecord, RowDecision } from './merge-types';

export interface PlaceMergeAction {
  decision: RowDecision;
  remoteId: string;
  /** Canonical local id when remapped or matched by id. */
  localId: string | null;
  winner: MergeRowRecord | null;
  conflict?: MergeConflict;
}

export interface PlaceMergePlan {
  actions: PlaceMergeAction[];
  /** remote place id → local place id */
  remap: Map<string, string>;
  conflicts: MergeConflict[];
}

function isDeleted(row: MergeRowRecord): boolean {
  const deletedAt = row.deleted_at;
  return deletedAt !== null && deletedAt !== undefined && deletedAt !== '';
}

function placeId(row: MergeRowRecord): string {
  return typeof row.id === 'string' ? row.id : String(row.id ?? '');
}

function normalizedName(row: MergeRowRecord): string {
  return typeof row.normalized_name === 'string' ? row.normalized_name : '';
}

/**
 * Index of active (non-deleted) places by normalized_name.
 * If several share a name, the lexicographically smallest id wins.
 */
export function buildLocalPlaceIndex(localPlaces: MergeRowRecord[]): Map<string, string> {
  const index = new Map<string, string>();

  for (const place of localPlaces) {
    if (isDeleted(place)) {
      continue;
    }
    const name = normalizedName(place);
    if (!name) {
      continue;
    }
    const id = placeId(place);
    const existing = index.get(name);
    if (!existing || id < existing) {
      index.set(name, id);
    }
  }

  return index;
}

/**
 * Plan place merge: identity by id, else dedupe by normalized_name with FK remap.
 */
export function planPlaceMerge(input: { localPlaces: MergeRowRecord[]; remotePlaces: MergeRowRecord[] }): PlaceMergePlan {
  const { localPlaces, remotePlaces } = input;
  const localById = new Map(localPlaces.map((p) => [placeId(p), p]));
  const nameIndex = buildLocalPlaceIndex(localPlaces);

  const actions: PlaceMergeAction[] = [];
  const remap = new Map<string, string>();
  const conflicts: MergeConflict[] = [];

  for (const remote of remotePlaces) {
    const remoteId = placeId(remote);
    const localSameId = localById.get(remoteId);

    if (localSameId) {
      const result = decideRowMerge({ table: 'places', local: localSameId, remote });
      pushAction(actions, conflicts, {
        decision: result.decision,
        remoteId,
        localId: remoteId,
        winner: result.winner,
        conflict: result.conflict
      });
      continue;
    }

    const matchLocalId = nameIndex.get(normalizedName(remote));
    if (matchLocalId) {
      remap.set(remoteId, matchLocalId);
      const local = localById.get(matchLocalId)!;
      const virtualRemote: MergeRowRecord = { ...remote, id: matchLocalId };
      const result = decideRowMerge({ table: 'places', local, remote: virtualRemote });

      // Never insert the remote id; winner keeps canonical local id.
      const winner = result.winner == null ? null : result.decision === 'take-remote' ? { ...result.winner, id: matchLocalId } : result.winner;

      const conflict =
        result.conflict == null
          ? undefined
          : {
              ...result.conflict,
              id: matchLocalId,
              remote: virtualRemote
            };

      pushAction(actions, conflicts, {
        decision: result.decision === 'insert-remote' ? 'take-remote' : result.decision,
        remoteId,
        localId: matchLocalId,
        winner,
        conflict
      });
      continue;
    }

    const result = decideRowMerge({ table: 'places', local: null, remote });
    pushAction(actions, conflicts, {
      decision: result.decision,
      remoteId,
      localId: null,
      winner: result.winner,
      conflict: result.conflict
    });
  }

  return { actions, remap, conflicts };
}

function pushAction(actions: PlaceMergeAction[], conflicts: MergeConflict[], action: PlaceMergeAction): void {
  actions.push(action);
  if (action.conflict) {
    conflicts.push(action.conflict);
  }
}

/** Remap place_id FK values using remoteId → localId map. */
export function applyPlaceRemapToRows<T extends Record<string, unknown>>(rows: T[], remap: Map<string, string>): T[] {
  if (remap.size === 0) {
    return rows;
  }

  return rows.map((row) => {
    const placeIdValue = row.place_id;
    if (typeof placeIdValue !== 'string') {
      return row;
    }
    const mapped = remap.get(placeIdValue);
    if (!mapped || mapped === placeIdValue) {
      return row;
    }
    return { ...row, place_id: mapped };
  });
}
