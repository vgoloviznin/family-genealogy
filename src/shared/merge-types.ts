/** Tables that participate in .fgtree sync/merge (app_meta is excluded). */
export type MergeableTable =
  | 'places'
  | 'people'
  | 'families'
  | 'family_partners'
  | 'family_children'
  | 'events'
  | 'associations'
  | 'sources'
  | 'citations'
  | 'media_assets'
  | 'media_links';

/** Dependency-safe order for applying merge decisions. */
export const MERGE_TABLE_ORDER: readonly MergeableTable[] = [
  'places',
  'people',
  'families',
  'family_partners',
  'family_children',
  'events',
  'associations',
  'sources',
  'citations',
  'media_assets',
  'media_links'
] as const;

/**
 * Content columns used for fingerprints.
 * Excludes updated_at, updated_by_device_id, updated_by_label.
 */
export const MERGEABLE_COLUMNS: Record<MergeableTable, readonly string[]> = {
  places: ['name', 'normalized_name', 'deleted_at'],
  people: ['first_name', 'last_name', 'middle_name', 'maiden_name', 'sex', 'is_living', 'notes', 'primary_photo_id', 'deleted_at'],
  families: ['union_type', 'notes', 'deleted_at'],
  family_partners: ['family_id', 'person_id', 'sort_order', 'deleted_at'],
  family_children: ['family_id', 'person_id', 'pedigree', 'deleted_at'],
  events: [
    'type',
    'custom_label',
    'person_id',
    'family_id',
    'place_id',
    'description',
    'latitude',
    'longitude',
    'date_year',
    'date_month',
    'date_day',
    'date_hour',
    'date_minute',
    'date_precision',
    'date_original_text',
    'date_sort_key',
    'deleted_at'
  ],
  associations: ['from_person_id', 'to_person_id', 'role', 'custom_role', 'event_id', 'notes', 'deleted_at'],
  sources: ['title', 'type', 'author', 'details', 'notes', 'deleted_at'],
  citations: ['source_id', 'person_id', 'event_id', 'page', 'excerpt', 'notes', 'deleted_at'],
  media_assets: [
    'relative_path',
    'file_name',
    'mime_type',
    'content_hash',
    'file_size',
    'caption',
    'description',
    'taken_at',
    'thumb_relative_path',
    'deleted_at'
  ],
  media_links: ['media_id', 'person_id', 'event_id', 'deleted_at']
};

/** Snake_case row as stored in SQLite / pack dumps. */
export type MergeRowRecord = Record<string, unknown>;

export type RowDecision = 'insert-remote' | 'keep-local' | 'take-remote' | 'conflict';

export interface MergeRowInput {
  table: MergeableTable;
  local?: MergeRowRecord | null;
  remote?: MergeRowRecord | null;
}

export interface MergeConflictField {
  column: string;
  local: unknown;
  remote: unknown;
}

export interface MergeConflictDetail {
  fields?: MergeConflictField[];
}

export interface MergeConflict {
  table: MergeableTable;
  id: string;
  local: MergeRowRecord;
  remote: MergeRowRecord;
  detail?: MergeConflictDetail;
}

export interface MergeRowResult {
  decision: RowDecision;
  /** Null when decision is conflict. */
  winner: MergeRowRecord | null;
  conflict?: MergeConflict;
}

export interface MergeConflictResolution {
  table: MergeableTable;
  id: string;
  choice: 'local' | 'remote';
}

export interface MergeTableStats {
  inserted: number;
  keptLocal: number;
  tookRemote: number;
  conflicts: number;
}

export interface MergePreviewResult {
  projectId: string;
  /** Absolute path of the .fgtree chosen for sync (needed for apply). */
  archivePath: string;
  conflicts: MergeConflict[];
  stats: Partial<Record<MergeableTable, MergeTableStats>>;
  mediaCopied: number;
  mediaSkipped: number;
  /** remote place id → local place id */
  placeRemap?: Record<string, string>;
  backupPath?: string | null;
}

export interface MergeApplyResult {
  applied: boolean;
  projectId: string;
  conflictsResolved: number;
  stats: Partial<Record<MergeableTable, MergeTableStats>>;
  mediaCopied: number;
  mediaSkipped: number;
  /** remote place id → local place id */
  placeRemap?: Record<string, string>;
  backupPath?: string | null;
}

/** Per-archive row in a batch preview (order is the sorted chain index). */
export interface BatchMergeArchivePreview {
  archivePath: string;
  order: number;
  exportedAt?: string;
  editorLabel?: string;
  sourceDeviceId?: string;
  stats: Partial<Record<MergeableTable, MergeTableStats>>;
  conflicts: MergeConflict[];
}

/**
 * Preview of syncing several .fgtree archives in exportedAt order.
 * Resolutions on apply are keyed by table+id only (no archivePath).
 */
export interface BatchMergePreviewResult {
  /** Sorted order used for the chain (and for apply). */
  archivePaths: string[];
  archives: BatchMergeArchivePreview[];
  /** One conflict per table+id; last archive that still conflicts wins. */
  allConflicts: MergeConflict[];
  unresolvedConflicts: number;
  /** Explains remote assumption used while advancing temp master. */
  previewNote?: string;
  totalStats?: Partial<Record<MergeableTable, MergeTableStats>>;
}

export interface BatchMergeApplyResult {
  backupPath: string | null;
  archives: MergeApplyResult[];
  totalStats: Partial<Record<MergeableTable, MergeTableStats>>;
  conflictsResolved: number;
  mediaCopied: number;
  mediaSkipped: number;
}
