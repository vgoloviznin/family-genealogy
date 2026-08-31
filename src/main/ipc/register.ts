import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/types';
import * as project from '../services/project';
import * as people from '../services/people';
import * as family from '../services/family';
import * as associations from '../services/associations';
import * as media from '../services/media';
import * as sources from '../services/sources';
import * as tree from '../services/tree';
import * as pack from '../services/pack';
import * as settings from '../services/settings';
import * as dialogs from '../services/dialogs';
import * as undo from '../services/undo';
import { isCloudSyncedPath } from '../utils/paths';

function wrap<T extends unknown[], R>(fn: (...args: T) => Promise<R> | R) {
  return async (_event: Electron.IpcMainInvokeEvent, ...args: T): Promise<R> => {
    return fn(...args);
  };
}

export function registerIpcHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_CREATE,
    wrap(async (_name: string) => project.createProject(_name))
  );
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_OPEN,
    wrap(() => project.openProject())
  );
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_OPEN_PATH,
    wrap((path: string) => project.openProjectAtPath(path))
  );
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_CLOSE,
    wrap(() => {
      undo.clearUndo();
      project.closeProject();
    })
  );
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_GET_CURRENT,
    wrap(() => project.getCurrentProject())
  );
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_GET_RECENTS,
    wrap(() => project.listRecentProjects())
  );
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_SET_NAME,
    wrap((name: string) => project.updateProjectName(name))
  );
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_CHECK_CLOUD_PATH,
    wrap((path: string) => isCloudSyncedPath(path))
  );

  ipcMain.handle(
    IPC_CHANNELS.PEOPLE_LIST,
    wrap(() => people.listPeople())
  );
  ipcMain.handle(
    IPC_CHANNELS.PEOPLE_GET,
    wrap((id: string) => people.getPersonDetail(id))
  );
  ipcMain.handle(
    IPC_CHANNELS.PEOPLE_CREATE,
    wrap((input) => people.createPerson(input))
  );
  ipcMain.handle(
    IPC_CHANNELS.PEOPLE_UPDATE,
    wrap((input) => people.updatePerson(input))
  );
  ipcMain.handle(
    IPC_CHANNELS.PEOPLE_DELETE,
    wrap((id: string) => people.deletePerson(id))
  );
  ipcMain.handle(
    IPC_CHANNELS.PEOPLE_SEARCH,
    wrap((q: string) => people.searchPeople(q))
  );

  ipcMain.handle(
    IPC_CHANNELS.FAMILY_ADD_PARTNER,
    wrap((personId, input, unionType) => family.addPartner(personId, input, unionType))
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_ADD_CHILD,
    wrap((personId, input, pedigree) => family.addChildToPerson(personId, input, pedigree))
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_ADD_PARENTS,
    wrap((personId, inputs, pedigree) => family.addParents(personId, inputs, pedigree))
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_ADD_SIBLING,
    wrap((personId, input, pedigree) => family.addSibling(personId, input, pedigree))
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_GET_FOR_PERSON,
    wrap((personId: string) => family.getFamiliesForPerson(personId))
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_LINK_PARTNER,
    wrap((personId, partnerId, unionType) => family.linkExistingPartner(personId, partnerId, unionType))
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_LINK_CHILD,
    wrap((personId, childId, pedigree) => family.linkExistingChild(personId, childId, pedigree))
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_LINK_PARENT,
    wrap((personId, parentId, pedigree) => family.linkExistingParent(personId, parentId, pedigree))
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_LINK_SIBLING,
    wrap((personId, siblingId, pedigree) => family.linkExistingSibling(personId, siblingId, pedigree))
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_LINK_PARTNER_TO_FAMILY,
    wrap((familyId, personId) => family.linkPartnerToFamily(familyId, personId))
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_LINK_CHILD_TO_FAMILY,
    wrap((familyId, childId, pedigree) => family.linkChildToFamily(familyId, childId, pedigree))
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_UNLINK_PARTNER,
    wrap((familyId, personId) => family.unlinkPartner(familyId, personId))
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_UNLINK_CHILD,
    wrap((familyId, personId) => family.unlinkChild(familyId, personId))
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_SET_UNION_TYPE,
    wrap((familyId, unionType) => family.setUnionType(familyId, unionType))
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_DISSOLVE_UNION,
    wrap((familyId, personId) => family.dissolveUnion(familyId, personId))
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_SET_PEDIGREE,
    wrap((familyId, childId, pedigree) => family.setChildPedigree(familyId, childId, pedigree))
  );

  ipcMain.handle(
    IPC_CHANNELS.EVENTS_LIST_FOR_PERSON,
    wrap((personId: string) => people.listEventsForPerson(personId))
  );
  ipcMain.handle(
    IPC_CHANNELS.EVENTS_UPSERT,
    wrap((input) => people.upsertEventRecord(input))
  );
  ipcMain.handle(
    IPC_CHANNELS.EVENTS_DELETE,
    wrap((id: string) => people.deleteEvent(id))
  );
  ipcMain.handle(
    IPC_CHANNELS.PLACES_SEARCH,
    wrap((q: string) => people.searchPlaces(q))
  );

  ipcMain.handle(
    IPC_CHANNELS.ASSOCIATIONS_LIST,
    wrap((personId: string) => associations.listAssociationsForPerson(personId))
  );
  ipcMain.handle(
    IPC_CHANNELS.ASSOCIATIONS_CREATE,
    wrap((input) => associations.createAssociation(input))
  );
  ipcMain.handle(
    IPC_CHANNELS.ASSOCIATIONS_DELETE,
    wrap((id: string) => associations.deleteAssociation(id))
  );

  ipcMain.handle(
    IPC_CHANNELS.MEDIA_ADD,
    wrap((target) => media.addMedia(target))
  );
  ipcMain.handle(
    IPC_CHANNELS.MEDIA_LIST,
    wrap(async (target) => {
      if (target.personId) {
        return media.listMediaForPerson(target.personId);
      }
      if (target.eventId) {
        return media.listMediaForEvent(target.eventId);
      }
      return [];
    })
  );
  ipcMain.handle(
    IPC_CHANNELS.MEDIA_DELETE,
    wrap((id: string) => media.deleteMedia(id))
  );
  ipcMain.handle(
    IPC_CHANNELS.MEDIA_SET_PRIMARY,
    wrap((personId, mediaId) => media.setPrimaryPhoto(personId, mediaId))
  );
  ipcMain.handle(
    IPC_CHANNELS.MEDIA_OPEN,
    wrap((id: string) => media.openMedia(id))
  );

  ipcMain.handle(
    IPC_CHANNELS.SOURCES_LIST,
    wrap(() => sources.listSources())
  );
  ipcMain.handle(
    IPC_CHANNELS.SOURCES_CREATE,
    wrap((input) => sources.createSource(input))
  );
  ipcMain.handle(
    IPC_CHANNELS.SOURCES_UPDATE,
    wrap((input) => sources.updateSource(input))
  );
  ipcMain.handle(
    IPC_CHANNELS.SOURCES_DELETE,
    wrap((id: string) => sources.deleteSource(id))
  );
  ipcMain.handle(
    IPC_CHANNELS.CITATIONS_LIST,
    wrap((personId: string) => sources.listCitationsForPerson(personId))
  );
  ipcMain.handle(
    IPC_CHANNELS.CITATIONS_CREATE,
    wrap((input) => sources.createCitation(input))
  );
  ipcMain.handle(
    IPC_CHANNELS.CITATIONS_DELETE,
    wrap((id: string) => sources.deleteCitation(id))
  );

  ipcMain.handle(
    IPC_CHANNELS.TREE_GET,
    wrap((personId?: string | null) => tree.getTree(personId))
  );

  ipcMain.handle(
    IPC_CHANNELS.PACK_EXPORT,
    wrap(() => pack.exportProject())
  );
  ipcMain.handle(
    IPC_CHANNELS.PACK_IMPORT,
    wrap(() => pack.importProject())
  );
  ipcMain.handle(
    IPC_CHANNELS.PACK_BACKUP,
    wrap(() => pack.backupProject())
  );
  ipcMain.handle(
    IPC_CHANNELS.PACK_RESTORE,
    wrap(() => pack.restoreProject())
  );
  ipcMain.handle(
    IPC_CHANNELS.PACK_SYNC_PREVIEW,
    wrap(() => pack.previewSyncFromArchive())
  );
  ipcMain.handle(
    IPC_CHANNELS.PACK_SYNC_APPLY,
    wrap((archivePath: string, resolutions) => pack.applySyncFromArchive(archivePath, resolutions))
  );
  ipcMain.handle(
    IPC_CHANNELS.PACK_SYNC_PREVIEW_BATCH,
    wrap(() => pack.previewSyncFromArchives())
  );
  ipcMain.handle(
    IPC_CHANNELS.PACK_SYNC_APPLY_BATCH,
    wrap((archivePaths: string[], resolutions) => pack.applySyncFromArchives(archivePaths, resolutions))
  );

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_GET,
    wrap(() => settings.getSettings())
  );
  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_SET,
    wrap((partial) => settings.updateSettings(partial))
  );
  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_PICK_FOLDER,
    wrap(() => dialogs.pickFolder())
  );

  ipcMain.handle(
    IPC_CHANNELS.UNDO_PUSH,
    wrap((action) => {
      undo.pushUndo(action);
      return undefined;
    })
  );
  ipcMain.handle(
    IPC_CHANNELS.UNDO_PERFORM,
    wrap(() => undo.performUndo())
  );
  ipcMain.handle(
    IPC_CHANNELS.UNDO_CAN,
    wrap(() => undo.canUndo())
  );

  ipcMain.handle(
    IPC_CHANNELS.DIALOG_CONFIRM,
    wrap((options) => dialogs.showConfirm(options))
  );
}
