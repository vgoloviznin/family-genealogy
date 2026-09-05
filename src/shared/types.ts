import type { BatchMergeApplyResult, BatchMergePreviewResult, MergeApplyResult, MergeConflictResolution, MergePreviewResult } from './merge-types';

export type { BatchMergeApplyResult, BatchMergePreviewResult, MergeApplyResult, MergeConflictResolution, MergePreviewResult } from './merge-types';

export type AppLocale = 'ru' | 'en' | 'it';

export const IPC_CHANNELS = {
  PROJECT_CREATE: 'project:create',
  PROJECT_OPEN: 'project:open',
  PROJECT_OPEN_PATH: 'project:openPath',
  PROJECT_CLOSE: 'project:close',
  PROJECT_GET_CURRENT: 'project:getCurrent',
  PROJECT_GET_RECENTS: 'project:getRecents',
  PROJECT_SET_NAME: 'project:setName',
  PROJECT_CHECK_CLOUD_PATH: 'project:checkCloudPath',

  PEOPLE_LIST: 'people:list',
  PEOPLE_GET: 'people:get',
  PEOPLE_CREATE: 'people:create',
  PEOPLE_UPDATE: 'people:update',
  PEOPLE_DELETE: 'people:delete',
  PEOPLE_SEARCH: 'people:search',

  FAMILY_ADD_PARTNER: 'family:addPartner',
  FAMILY_ADD_CHILD: 'family:addChild',
  FAMILY_ADD_PARENTS: 'family:addParents',
  FAMILY_ADD_SIBLING: 'family:addSibling',
  FAMILY_GET_FOR_PERSON: 'family:getForPerson',
  FAMILY_LINK_PARTNER: 'family:linkPartner',
  FAMILY_LINK_CHILD: 'family:linkChild',
  FAMILY_LINK_PARENT: 'family:linkParent',
  FAMILY_LINK_SIBLING: 'family:linkSibling',
  FAMILY_LINK_PARTNER_TO_FAMILY: 'family:linkPartnerToFamily',
  FAMILY_LINK_CHILD_TO_FAMILY: 'family:linkChildToFamily',
  FAMILY_ADD_CHILD_TO_FAMILY: 'family:addChildToFamily',
  FAMILY_UNLINK_PARTNER: 'family:unlinkPartner',
  FAMILY_UNLINK_CHILD: 'family:unlinkChild',
  FAMILY_SET_UNION_TYPE: 'family:setUnionType',
  FAMILY_DISSOLVE_UNION: 'family:dissolveUnion',
  FAMILY_SET_PEDIGREE: 'family:setPedigree',

  EVENTS_LIST_FOR_PERSON: 'events:listForPerson',
  EVENTS_UPSERT: 'events:upsert',
  EVENTS_DELETE: 'events:delete',
  PLACES_SEARCH: 'places:search',

  ASSOCIATIONS_LIST: 'associations:list',
  ASSOCIATIONS_CREATE: 'associations:create',
  ASSOCIATIONS_DELETE: 'associations:delete',

  MEDIA_ADD: 'media:add',
  MEDIA_LIST: 'media:list',
  MEDIA_DELETE: 'media:delete',
  MEDIA_SET_PRIMARY: 'media:setPrimary',
  MEDIA_OPEN: 'media:open',

  SOURCES_LIST: 'sources:list',
  SOURCES_CREATE: 'sources:create',
  SOURCES_UPDATE: 'sources:update',
  SOURCES_DELETE: 'sources:delete',
  CITATIONS_LIST: 'citations:list',
  CITATIONS_CREATE: 'citations:create',
  CITATIONS_DELETE: 'citations:delete',

  TREE_GET: 'tree:get',

  PACK_EXPORT: 'pack:export',
  PACK_IMPORT: 'pack:import',
  PACK_BACKUP: 'pack:backup',
  PACK_RESTORE: 'pack:restore',
  PACK_SYNC_PREVIEW: 'pack:syncPreview',
  PACK_SYNC_APPLY: 'pack:syncApply',
  PACK_SYNC_PREVIEW_BATCH: 'pack:syncPreviewBatch',
  PACK_SYNC_APPLY_BATCH: 'pack:syncApplyBatch',
  PACK_PROGRESS: 'pack:progress',

  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_PICK_FOLDER: 'settings:pickFolder',
  SETTINGS_DEFAULT_BACKUP_FOLDER: 'settings:getDefaultBackupFolder',

  UNDO_PERFORM: 'undo:perform',
  UNDO_CAN: 'undo:can',

  DIALOG_CONFIRM: 'dialog:confirm',

  APP_PREPARE_QUIT: 'app:prepare-quit',
  APP_PREPARE_QUIT_DONE: 'app:prepare-quit-done',
  APP_COPY_DIAGNOSTICS: 'app:copyDiagnostics'
} as const;

export type ConfirmDialogOptions = {
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export type MenuCommand =
  'createProject' | 'openProject' | 'import' | 'export' | 'backup' | 'restore' | 'sync' | 'syncBatch' | 'syncHelp' | 'undo' | 'copyDiagnostics';

export type Sex = 'male' | 'female' | 'other' | 'unknown';
export type PedigreeType = 'birth' | 'adopted' | 'step' | 'foster';
export type UnionType = 'marriage' | 'partnership' | 'unknown';
export type DatePrecision = 'exact' | 'year' | 'month' | 'circa' | 'before' | 'after' | 'unknown';
export type SourceType = 'book' | 'archive' | 'document' | 'oral' | 'website' | 'photo' | 'other';

export type AssociationRole = 'godparent' | 'witness' | 'clergy' | 'officiator' | 'friend' | 'neighbor' | 'guardian' | 'executor' | 'other';

export type EventTypeCode =
  | 'birth'
  | 'baptism'
  | 'death'
  | 'burial'
  | 'cremation'
  | 'adoption'
  | 'education'
  | 'occupation'
  | 'residence'
  | 'emigration'
  | 'immigration'
  | 'census'
  | 'military'
  | 'retirement'
  | 'will'
  | 'engagement'
  | 'marriage'
  | 'divorce'
  | 'cohabitation'
  | 'custom';

export interface PartialDate {
  year?: number | null;
  month?: number | null;
  day?: number | null;
  hour?: number | null;
  minute?: number | null;
  precision: DatePrecision;
  originalText?: string | null;
  sortKey?: number | null;
}

export interface ProjectMeta {
  projectId: string;
  name: string;
  schemaVersion: number;
  createdAt: string;
  path: string;
  cloudWarning?: boolean;
}

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  maidenName?: string | null;
  sex: Sex;
  isLiving: boolean;
  notes?: string | null;
  primaryPhotoId?: string | null;
  thumbUrl?: string | null;
  birthYear?: number | null;
  deathYear?: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface PersonDetail extends Person {
  birthEvent?: LifeEvent | null;
  deathEvent?: LifeEvent | null;
  burialEvent?: LifeEvent | null;
  families: FamilySummary[];
  associations: AssociationView[];
  events: LifeEvent[];
  media: MediaItem[];
  citations: CitationView[];
}

export interface LifeEvent {
  id: string;
  type: EventTypeCode;
  customLabel?: string | null;
  personId?: string | null;
  familyId?: string | null;
  placeId?: string | null;
  placeName?: string | null;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  date: PartialDate;
  createdAt: string;
  updatedAt: string;
}

export interface FamilySummary {
  id: string;
  unionType: UnionType;
  partners: Person[];
  children: Array<{ person: Person; pedigree: PedigreeType }>;
}

export interface AssociationView {
  id: string;
  role: AssociationRole;
  customRole?: string | null;
  fromPersonId: string;
  toPersonId: string;
  toPerson: Person;
  eventId?: string | null;
  notes?: string | null;
}

export interface MediaItem {
  id: string;
  fileName: string;
  mimeType: string;
  caption?: string | null;
  description?: string | null;
  takenAt?: string | null;
  thumbUrl?: string;
  isPrimary?: boolean;
}

export interface Source {
  id: string;
  title: string;
  type: SourceType;
  author?: string | null;
  details?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CitationView {
  id: string;
  sourceId: string;
  source: Source;
  personId?: string | null;
  eventId?: string | null;
  page?: string | null;
  excerpt?: string | null;
  notes?: string | null;
}

export interface TreeNode {
  id: string;
  person: Person;
  type: 'ancestor' | 'focus' | 'descendant';
  generation: number;
}

export interface TreeEdge {
  id: string;
  source: string;
  target: string;
  kind: 'parent' | 'partner' | 'sibling';
}

export interface TreeFamily {
  id: string;
  partners: string[];
  children: string[];
}

export interface TreeData {
  nodes: TreeNode[];
  edges: TreeEdge[];
  families: TreeFamily[];
  focusPersonId: string | null;
}

export interface RecentProject {
  path: string;
  name: string;
}

export interface AppSettings {
  deviceId: string;
  editorLabel: string;
  locale: AppLocale;
  backupFolder?: string;
  backupOnQuit: boolean;
  backupKeepCount: number;
  recentProjects: string[];
  /** First-run wizard completed (language, editor label, backup folder). */
  onboardingComplete?: boolean;
}

export interface PackProgress {
  phase: 'pack' | 'unpack' | 'merge';
  current: number;
  total: number;
  message: string;
}

export interface CreatePersonInput {
  firstName: string;
  lastName: string;
  middleName?: string;
  maidenName?: string;
  sex?: Sex;
  isLiving?: boolean;
  notes?: string;
  birth?: Partial<Omit<LifeEvent, 'id' | 'createdAt' | 'updatedAt'>>;
  death?: Partial<Omit<LifeEvent, 'id' | 'createdAt' | 'updatedAt'>>;
  burial?: Partial<Omit<LifeEvent, 'id' | 'createdAt' | 'updatedAt'>>;
}

export interface UpdatePersonInput extends Partial<Omit<CreatePersonInput, 'death' | 'burial'>> {
  id: string;
  /** null — удалить событие смерти (например, при отметке «жив») */
  death?: Partial<Omit<LifeEvent, 'id' | 'createdAt' | 'updatedAt'>> | null;
  /** null — удалить место захоронения */
  burial?: Partial<Omit<LifeEvent, 'id' | 'createdAt' | 'updatedAt'>> | null;
}

export interface UpsertEventInput {
  id?: string;
  type: EventTypeCode;
  customLabel?: string;
  personId?: string;
  familyId?: string;
  placeName?: string;
  description?: string;
  latitude?: number | null;
  longitude?: number | null;
  date: PartialDate;
}

export interface CreateAssociationInput {
  fromPersonId: string;
  toPersonId: string;
  role: AssociationRole;
  customRole?: string;
  eventId?: string;
  notes?: string;
}

export interface CreateSourceInput {
  title: string;
  type?: SourceType;
  author?: string;
  details?: string;
  notes?: string;
}

export interface CreateCitationInput {
  sourceId?: string;
  newSource?: CreateSourceInput;
  personId?: string;
  eventId?: string;
  page?: string;
  excerpt?: string;
  notes?: string;
}

export type UndoAction =
  | { type: 'person-update'; before: UpdatePersonInput }
  | { type: 'person-undelete'; id: string }
  | { type: 'person-delete'; id: string }
  | { type: 'event-delete'; id: string }
  | { type: 'event-restore'; event: UpsertEventInput & { id: string } }
  | { type: 'family-unlink-partner'; familyId: string; personId: string }
  | { type: 'family-unlink-child'; familyId: string; personId: string }
  | { type: 'family-relink-partner'; familyId: string; personId: string }
  | { type: 'family-relink-child'; familyId: string; personId: string; pedigree: PedigreeType }
  | { type: 'citation-delete'; id: string }
  | { type: 'citation-restore'; id: string };

export interface Api {
  project: {
    create: (name: string) => Promise<ProjectMeta | null>;
    open: () => Promise<ProjectMeta | null>;
    openPath: (path: string) => Promise<ProjectMeta>;
    close: () => Promise<void>;
    getCurrent: () => Promise<ProjectMeta | null>;
    getRecents: () => Promise<RecentProject[]>;
    setName: (name: string) => Promise<ProjectMeta>;
    checkCloudPath: (path: string) => Promise<boolean>;
    onOpened: (callback: (meta: ProjectMeta) => void) => () => void;
  };
  people: {
    list: () => Promise<Person[]>;
    get: (id: string) => Promise<PersonDetail | null>;
    create: (input: CreatePersonInput) => Promise<PersonDetail>;
    update: (input: UpdatePersonInput) => Promise<PersonDetail>;
    delete: (id: string) => Promise<void>;
    search: (query: string) => Promise<Person[]>;
  };
  family: {
    addPartner: (personId: string, partnerInput: CreatePersonInput, unionType?: UnionType) => Promise<PersonDetail>;
    addChild: (personId: string, childInput: CreatePersonInput, pedigree?: PedigreeType, familyId?: string | 'new') => Promise<PersonDetail>;
    addParents: (personId: string, parentInputs: [CreatePersonInput, CreatePersonInput?], pedigree?: PedigreeType) => Promise<PersonDetail>;
    addSibling: (personId: string, siblingInput: CreatePersonInput, pedigree?: PedigreeType) => Promise<PersonDetail>;
    getForPerson: (personId: string) => Promise<FamilySummary[]>;
    linkPartner: (personId: string, partnerId: string, unionType?: UnionType) => Promise<void>;
    linkChild: (personId: string, childId: string, pedigree?: PedigreeType, familyId?: string | 'new') => Promise<void>;
    linkParent: (personId: string, parentId: string, pedigree?: PedigreeType) => Promise<void>;
    linkSibling: (personId: string, siblingId: string, pedigree?: PedigreeType) => Promise<void>;
    linkPartnerToFamily: (familyId: string, personId: string) => Promise<void>;
    linkChildToFamily: (familyId: string, childId: string, pedigree?: PedigreeType) => Promise<void>;
    addChildToFamily: (familyId: string, childInput: CreatePersonInput, pedigree?: PedigreeType) => Promise<PersonDetail>;
    unlinkPartner: (familyId: string, personId: string) => Promise<void>;
    unlinkChild: (familyId: string, personId: string) => Promise<void>;
    setUnionType: (familyId: string, unionType: UnionType) => Promise<void>;
    dissolveUnion: (familyId: string, personId: string) => Promise<void>;
    setPedigree: (familyId: string, childId: string, pedigree: PedigreeType) => Promise<void>;
  };
  events: {
    listForPerson: (personId: string) => Promise<LifeEvent[]>;
    upsert: (input: UpsertEventInput) => Promise<LifeEvent>;
    delete: (id: string) => Promise<void>;
  };
  places: {
    search: (query: string) => Promise<Array<{ id: string; name: string }>>;
  };
  associations: {
    list: (personId: string) => Promise<AssociationView[]>;
    create: (input: CreateAssociationInput) => Promise<AssociationView>;
    delete: (id: string) => Promise<void>;
  };
  media: {
    add: (target: { personId?: string; eventId?: string; imagesOnly?: boolean; setPrimary?: boolean; multiple?: boolean }) => Promise<MediaItem[]>;
    list: (target: { personId?: string; eventId?: string }) => Promise<MediaItem[]>;
    delete: (id: string) => Promise<void>;
    setPrimary: (personId: string, mediaId: string) => Promise<void>;
    open: (id: string) => Promise<void>;
  };
  sources: {
    list: () => Promise<Source[]>;
    create: (input: CreateSourceInput) => Promise<Source>;
    update: (input: Partial<CreateSourceInput> & { id: string }) => Promise<Source>;
    delete: (id: string) => Promise<void>;
  };
  citations: {
    listForPerson: (personId: string) => Promise<CitationView[]>;
    create: (input: CreateCitationInput) => Promise<CitationView>;
    delete: (id: string) => Promise<void>;
  };
  tree: {
    get: (personId?: string | null) => Promise<TreeData>;
  };
  pack: {
    export: () => Promise<string | null>;
    import: () => Promise<ProjectMeta | null>;
    backup: () => Promise<string | null>;
    restore: () => Promise<ProjectMeta | null>;
    previewSyncFromArchive: () => Promise<MergePreviewResult | null>;
    applySyncFromArchive: (archivePath: string, resolutions: MergeConflictResolution[]) => Promise<MergeApplyResult>;
    previewSyncFromArchives: () => Promise<BatchMergePreviewResult | null>;
    applySyncFromArchives: (archivePaths: string[], resolutions: MergeConflictResolution[]) => Promise<BatchMergeApplyResult>;
    onProgress: (callback: (progress: PackProgress) => void) => () => void;
  };
  settings: {
    get: () => Promise<AppSettings>;
    set: (partial: Partial<AppSettings>) => Promise<AppSettings>;
    pickFolder: () => Promise<string | null>;
    getDefaultBackupFolder: () => Promise<string>;
  };
  undo: {
    perform: () => Promise<UndoAction | null>;
    canUndo: () => Promise<boolean>;
  };
  menu: {
    onCommand: (callback: (command: MenuCommand) => void) => () => void;
  };
  dialog: {
    confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  };
  app: {
    onPrepareQuit: (handler: () => Promise<boolean>) => () => void;
    copyDiagnostics: () => Promise<{ ok: true }>;
  };
}

declare global {
  interface Window {
    api: Api;
  }
}

export {};
