import { contextBridge, ipcRenderer } from 'electron'
import { assertFamilyApi, createFamilyApi } from '@shared/family-api'
import { IPC_CHANNELS } from '@shared/types'
import type { Api, PackProgress, ProjectMeta, MenuCommand, UndoAction } from '@shared/types'

const api: Api = {
  project: {
    create: (name) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE, name),
    open: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_OPEN),
    openPath: (path) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_OPEN_PATH, path),
    close: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CLOSE),
    getCurrent: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_GET_CURRENT),
    getRecents: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_GET_RECENTS),
    checkCloudPath: (path) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CHECK_CLOUD_PATH, path),
    onOpened: (callback) => {
      const handler = (_: unknown, meta: ProjectMeta) => callback(meta)
      ipcRenderer.on('project:opened', handler)
      return () => ipcRenderer.removeListener('project:opened', handler)
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
    get: (personId, generations) => ipcRenderer.invoke(IPC_CHANNELS.TREE_GET, personId, generations)
  },
  pack: {
    export: () => ipcRenderer.invoke(IPC_CHANNELS.PACK_EXPORT),
    import: () => ipcRenderer.invoke(IPC_CHANNELS.PACK_IMPORT),
    backup: () => ipcRenderer.invoke(IPC_CHANNELS.PACK_BACKUP),
    restore: () => ipcRenderer.invoke(IPC_CHANNELS.PACK_RESTORE),
    onProgress: (callback) => {
      const handler = (_: unknown, progress: PackProgress) => callback(progress)
      ipcRenderer.on('pack:progress', handler)
      return () => ipcRenderer.removeListener('pack:progress', handler)
    }
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
    set: (partial) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, partial),
    pickFolder: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_PICK_FOLDER)
  },
  undo: {
    push: (action: UndoAction) => ipcRenderer.invoke(IPC_CHANNELS.UNDO_PUSH, action),
    perform: () => ipcRenderer.invoke(IPC_CHANNELS.UNDO_PERFORM),
    canUndo: () => ipcRenderer.invoke(IPC_CHANNELS.UNDO_CAN)
  },
  menu: {
    onCommand: (callback) => {
      const handler = (_: unknown, command: MenuCommand) => callback(command)
      ipcRenderer.on('menu:command', handler)
      return () => ipcRenderer.removeListener('menu:command', handler)
    }
  }
}

assertFamilyApi(api.family)
contextBridge.exposeInMainWorld('api', api)

export type { Api }
