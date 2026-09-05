import { contextBridge, ipcRenderer } from 'electron';
import { assertFamilyApi, createFamilyApi } from '@shared/family-api';
import { IPC_CHANNELS } from '@shared/types';
import type { Api, ConfirmDialogOptions, PackProgress, ProjectMeta, MenuCommand } from '@shared/types';

const api: Api = {
  project: {
    create: (name) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE, name),
    open: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_OPEN),
    openPath: (path) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_OPEN_PATH, path),
    close: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CLOSE),
    getCurrent: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_GET_CURRENT),
    getRecents: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_GET_RECENTS),
    setName: (name) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_SET_NAME, name),
    checkCloudPath: (path) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CHECK_CLOUD_PATH, path),
    onOpened: (callback) => {
      const handler = (_: unknown, meta: ProjectMeta) => callback(meta);
      ipcRenderer.on('project:opened', handler);
      return () => ipcRenderer.removeListener('project:opened', handler);
    }
  },
  people: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.PEOPLE_LIST),
    get: (id) => ipcRenderer.invoke(IPC_CHANNELS.PEOPLE_GET, id),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.PEOPLE_CREATE, input),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.PEOPLE_UPDATE, input),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.PEOPLE_DELETE, id),
    search: (query) => ipcRenderer.invoke(IPC_CHANNELS.PEOPLE_SEARCH, query)
  },
  family: createFamilyApi((channel, ...args) => ipcRenderer.invoke(channel, ...args)),
  events: {
    listForPerson: (personId) => ipcRenderer.invoke(IPC_CHANNELS.EVENTS_LIST_FOR_PERSON, personId),
    upsert: (input) => ipcRenderer.invoke(IPC_CHANNELS.EVENTS_UPSERT, input),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.EVENTS_DELETE, id)
  },
  places: {
    search: (query) => ipcRenderer.invoke(IPC_CHANNELS.PLACES_SEARCH, query)
  },
  associations: {
    list: (personId) => ipcRenderer.invoke(IPC_CHANNELS.ASSOCIATIONS_LIST, personId),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.ASSOCIATIONS_CREATE, input),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.ASSOCIATIONS_DELETE, id)
  },
  media: {
    add: (target) => ipcRenderer.invoke(IPC_CHANNELS.MEDIA_ADD, target),
    list: (target) => ipcRenderer.invoke(IPC_CHANNELS.MEDIA_LIST, target),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.MEDIA_DELETE, id),
    setPrimary: (personId, mediaId) => ipcRenderer.invoke(IPC_CHANNELS.MEDIA_SET_PRIMARY, personId, mediaId),
    open: (id) => ipcRenderer.invoke(IPC_CHANNELS.MEDIA_OPEN, id)
  },
  sources: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.SOURCES_LIST),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.SOURCES_CREATE, input),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.SOURCES_UPDATE, input),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.SOURCES_DELETE, id)
  },
  citations: {
    listForPerson: (personId) => ipcRenderer.invoke(IPC_CHANNELS.CITATIONS_LIST, personId),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.CITATIONS_CREATE, input),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.CITATIONS_DELETE, id)
  },
  tree: {
    get: (personId) => ipcRenderer.invoke(IPC_CHANNELS.TREE_GET, personId)
  },
  pack: {
    export: () => ipcRenderer.invoke(IPC_CHANNELS.PACK_EXPORT),
    import: () => ipcRenderer.invoke(IPC_CHANNELS.PACK_IMPORT),
    backup: () => ipcRenderer.invoke(IPC_CHANNELS.PACK_BACKUP),
    restore: () => ipcRenderer.invoke(IPC_CHANNELS.PACK_RESTORE),
    previewSyncFromArchive: () => ipcRenderer.invoke(IPC_CHANNELS.PACK_SYNC_PREVIEW),
    applySyncFromArchive: (archivePath, resolutions) => ipcRenderer.invoke(IPC_CHANNELS.PACK_SYNC_APPLY, archivePath, resolutions),
    previewSyncFromArchives: () => ipcRenderer.invoke(IPC_CHANNELS.PACK_SYNC_PREVIEW_BATCH),
    applySyncFromArchives: (archivePaths, resolutions) => ipcRenderer.invoke(IPC_CHANNELS.PACK_SYNC_APPLY_BATCH, archivePaths, resolutions),
    onProgress: (callback) => {
      const handler = (_: unknown, progress: PackProgress) => callback(progress);
      ipcRenderer.on('pack:progress', handler);
      return () => ipcRenderer.removeListener('pack:progress', handler);
    }
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
    set: (partial) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, partial),
    pickFolder: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_PICK_FOLDER),
    getDefaultBackupFolder: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_DEFAULT_BACKUP_FOLDER)
  },
  undo: {
    perform: () => ipcRenderer.invoke(IPC_CHANNELS.UNDO_PERFORM),
    canUndo: () => ipcRenderer.invoke(IPC_CHANNELS.UNDO_CAN)
  },
  menu: {
    onCommand: (callback) => {
      const handler = (_: unknown, command: MenuCommand) => callback(command);
      ipcRenderer.on('menu:command', handler);
      return () => ipcRenderer.removeListener('menu:command', handler);
    }
  },
  dialog: {
    confirm: (options: ConfirmDialogOptions) => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_CONFIRM, options)
  },
  app: {
    onPrepareQuit: (handler) => {
      const listener = () => {
        void handler().then((proceed) => {
          ipcRenderer.send(IPC_CHANNELS.APP_PREPARE_QUIT_DONE, proceed);
        });
      };
      ipcRenderer.on(IPC_CHANNELS.APP_PREPARE_QUIT, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.APP_PREPARE_QUIT, listener);
    },
    copyDiagnostics: () => ipcRenderer.invoke(IPC_CHANNELS.APP_COPY_DIAGNOSTICS)
  }
};

assertFamilyApi(api.family);
contextBridge.exposeInMainWorld('api', api);

export type { Api };
