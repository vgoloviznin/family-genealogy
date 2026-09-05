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
import { copyDiagnosticsToClipboard } from '../services/diagnostics';
import { isCloudSyncedPath } from '../utils/paths';
import { applyAppLocale } from '../locale';
import {
  wrap,
  assertId,
  assertPlainObject,
  assertOptionalId,
  assertFamilyIdOrNew,
  assertOptionalPedigree,
  assertPedigree,
  assertOptionalUnionType,
  assertUnionType,
  assertParentInputs,
  assertStringArray
} from './wrap';

export function registerIpcHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_CREATE,
    wrap(IPC_CHANNELS.PROJECT_CREATE, async (name: string) => {
      if (typeof name !== 'string') {
        assertId(name, 'name');
      }
      return project.createProject(name);
    })
  );
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_OPEN,
    wrap(IPC_CHANNELS.PROJECT_OPEN, () => project.openProject())
  );
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_OPEN_PATH,
    wrap(IPC_CHANNELS.PROJECT_OPEN_PATH, (path: string) => {
      settings.assertOnboardingComplete();
      return project.openProjectAtPath(assertId(path, 'path'));
    })
  );
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_CLOSE,
    wrap(IPC_CHANNELS.PROJECT_CLOSE, () => {
      undo.clearUndo();
      project.closeProject();
    })
  );
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_GET_CURRENT,
    wrap(IPC_CHANNELS.PROJECT_GET_CURRENT, () => project.getCurrentProject())
  );
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_GET_RECENTS,
    wrap(IPC_CHANNELS.PROJECT_GET_RECENTS, () => project.listRecentProjects())
  );
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_SET_NAME,
    wrap(IPC_CHANNELS.PROJECT_SET_NAME, (name: string) => project.updateProjectName(typeof name === 'string' ? name : assertId(name, 'name')))
  );
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_CHECK_CLOUD_PATH,
    wrap(IPC_CHANNELS.PROJECT_CHECK_CLOUD_PATH, (path: string) => isCloudSyncedPath(assertId(path, 'path')))
  );

  ipcMain.handle(
    IPC_CHANNELS.PEOPLE_LIST,
    wrap(IPC_CHANNELS.PEOPLE_LIST, () => people.listPeople())
  );
  ipcMain.handle(
    IPC_CHANNELS.PEOPLE_GET,
    wrap(IPC_CHANNELS.PEOPLE_GET, (id: string) => people.getPersonDetail(assertId(id)))
  );
  ipcMain.handle(
    IPC_CHANNELS.PEOPLE_CREATE,
    wrap(IPC_CHANNELS.PEOPLE_CREATE, (input) => people.createPerson(assertPlainObject(input) as never))
  );
  ipcMain.handle(
    IPC_CHANNELS.PEOPLE_UPDATE,
    wrap(IPC_CHANNELS.PEOPLE_UPDATE, (input) => {
      const obj = assertPlainObject(input);
      assertId(obj.id);
      return people.updatePerson(obj as never);
    })
  );
  ipcMain.handle(
    IPC_CHANNELS.PEOPLE_DELETE,
    wrap(IPC_CHANNELS.PEOPLE_DELETE, (id: string) => people.deletePerson(assertId(id)))
  );
  ipcMain.handle(
    IPC_CHANNELS.PEOPLE_SEARCH,
    wrap(IPC_CHANNELS.PEOPLE_SEARCH, (q: string) => people.searchPeople(typeof q === 'string' ? q : ''))
  );

  ipcMain.handle(
    IPC_CHANNELS.FAMILY_ADD_PARTNER,
    wrap(IPC_CHANNELS.FAMILY_ADD_PARTNER, (personId, input, unionType) =>
      family.addPartner(assertId(personId, 'personId'), assertPlainObject(input) as never, assertOptionalUnionType(unionType) ?? 'marriage')
    )
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_ADD_CHILD,
    wrap(IPC_CHANNELS.FAMILY_ADD_CHILD, (personId, input, pedigree, familyId) =>
      family.addChildToPerson(
        assertId(personId, 'personId'),
        assertPlainObject(input) as never,
        assertOptionalPedigree(pedigree) ?? 'birth',
        assertFamilyIdOrNew(familyId)
      )
    )
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_ADD_PARENTS,
    wrap(IPC_CHANNELS.FAMILY_ADD_PARENTS, (personId, inputs, pedigree) =>
      family.addParents(assertId(personId, 'personId'), assertParentInputs(inputs), assertOptionalPedigree(pedigree) ?? 'birth')
    )
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_ADD_SIBLING,
    wrap(IPC_CHANNELS.FAMILY_ADD_SIBLING, (personId, input, pedigree) =>
      family.addSibling(assertId(personId, 'personId'), assertPlainObject(input) as never, assertOptionalPedigree(pedigree) ?? 'birth')
    )
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_GET_FOR_PERSON,
    wrap(IPC_CHANNELS.FAMILY_GET_FOR_PERSON, (personId: string) => family.getFamiliesForPerson(assertId(personId, 'personId')))
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_LINK_PARTNER,
    wrap(IPC_CHANNELS.FAMILY_LINK_PARTNER, (personId, partnerId, unionType) =>
      family.linkExistingPartner(assertId(personId, 'personId'), assertId(partnerId, 'partnerId'), assertOptionalUnionType(unionType) ?? 'marriage')
    )
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_LINK_CHILD,
    wrap(IPC_CHANNELS.FAMILY_LINK_CHILD, (personId, childId, pedigree, familyId) =>
      family.linkExistingChild(
        assertId(personId, 'personId'),
        assertId(childId, 'childId'),
        assertOptionalPedigree(pedigree) ?? 'birth',
        assertFamilyIdOrNew(familyId)
      )
    )
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_LINK_PARENT,
    wrap(IPC_CHANNELS.FAMILY_LINK_PARENT, (personId, parentId, pedigree) =>
      family.linkExistingParent(assertId(personId, 'personId'), assertId(parentId, 'parentId'), assertOptionalPedigree(pedigree) ?? 'birth')
    )
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_LINK_SIBLING,
    wrap(IPC_CHANNELS.FAMILY_LINK_SIBLING, (personId, siblingId, pedigree) =>
      family.linkExistingSibling(assertId(personId, 'personId'), assertId(siblingId, 'siblingId'), assertOptionalPedigree(pedigree) ?? 'birth')
    )
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_LINK_PARTNER_TO_FAMILY,
    wrap(IPC_CHANNELS.FAMILY_LINK_PARTNER_TO_FAMILY, (familyId, personId) =>
      family.linkPartnerToFamily(assertId(familyId, 'familyId'), assertId(personId, 'personId'))
    )
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_LINK_CHILD_TO_FAMILY,
    wrap(IPC_CHANNELS.FAMILY_LINK_CHILD_TO_FAMILY, (familyId, childId, pedigree) =>
      family.linkChildToFamily(assertId(familyId, 'familyId'), assertId(childId, 'childId'), assertOptionalPedigree(pedigree) ?? 'birth')
    )
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_ADD_CHILD_TO_FAMILY,
    wrap(IPC_CHANNELS.FAMILY_ADD_CHILD_TO_FAMILY, (familyId, input, pedigree) =>
      family.addChildToFamily(assertId(familyId, 'familyId'), assertPlainObject(input) as never, assertOptionalPedigree(pedigree) ?? 'birth')
    )
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_UNLINK_PARTNER,
    wrap(IPC_CHANNELS.FAMILY_UNLINK_PARTNER, (familyId, personId) =>
      family.unlinkPartner(assertId(familyId, 'familyId'), assertId(personId, 'personId'))
    )
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_UNLINK_CHILD,
    wrap(IPC_CHANNELS.FAMILY_UNLINK_CHILD, (familyId, personId) => family.unlinkChild(assertId(familyId, 'familyId'), assertId(personId, 'personId')))
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_SET_UNION_TYPE,
    wrap(IPC_CHANNELS.FAMILY_SET_UNION_TYPE, (familyId, unionType) => family.setUnionType(assertId(familyId, 'familyId'), assertUnionType(unionType)))
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_DISSOLVE_UNION,
    wrap(IPC_CHANNELS.FAMILY_DISSOLVE_UNION, (familyId, personId) =>
      family.dissolveUnion(assertId(familyId, 'familyId'), assertId(personId, 'personId'))
    )
  );
  ipcMain.handle(
    IPC_CHANNELS.FAMILY_SET_PEDIGREE,
    wrap(IPC_CHANNELS.FAMILY_SET_PEDIGREE, (familyId, childId, pedigree) =>
      family.setChildPedigree(assertId(familyId, 'familyId'), assertId(childId, 'childId'), assertPedigree(pedigree))
    )
  );

  ipcMain.handle(
    IPC_CHANNELS.EVENTS_LIST_FOR_PERSON,
    wrap(IPC_CHANNELS.EVENTS_LIST_FOR_PERSON, (personId: string) => people.listEventsForPerson(assertId(personId, 'personId')))
  );
  ipcMain.handle(
    IPC_CHANNELS.EVENTS_UPSERT,
    wrap(IPC_CHANNELS.EVENTS_UPSERT, (input) => people.upsertEventRecord(assertPlainObject(input) as never))
  );
  ipcMain.handle(
    IPC_CHANNELS.EVENTS_DELETE,
    wrap(IPC_CHANNELS.EVENTS_DELETE, (id: string) => people.deleteEvent(assertId(id)))
  );
  ipcMain.handle(
    IPC_CHANNELS.PLACES_SEARCH,
    wrap(IPC_CHANNELS.PLACES_SEARCH, (q: string) => people.searchPlaces(typeof q === 'string' ? q : ''))
  );

  ipcMain.handle(
    IPC_CHANNELS.ASSOCIATIONS_LIST,
    wrap(IPC_CHANNELS.ASSOCIATIONS_LIST, (personId: string) => associations.listAssociationsForPerson(assertId(personId, 'personId')))
  );
  ipcMain.handle(
    IPC_CHANNELS.ASSOCIATIONS_CREATE,
    wrap(IPC_CHANNELS.ASSOCIATIONS_CREATE, (input) => associations.createAssociation(assertPlainObject(input) as never))
  );
  ipcMain.handle(
    IPC_CHANNELS.ASSOCIATIONS_DELETE,
    wrap(IPC_CHANNELS.ASSOCIATIONS_DELETE, (id: string) => associations.deleteAssociation(assertId(id)))
  );

  ipcMain.handle(
    IPC_CHANNELS.MEDIA_ADD,
    wrap(IPC_CHANNELS.MEDIA_ADD, (target) => media.addMedia(assertPlainObject(target) as never))
  );
  ipcMain.handle(
    IPC_CHANNELS.MEDIA_LIST,
    wrap(IPC_CHANNELS.MEDIA_LIST, async (target) => {
      const obj = assertPlainObject(target);
      if (typeof obj.personId === 'string') {
        return media.listMediaForPerson(obj.personId);
      }
      if (typeof obj.eventId === 'string') {
        return media.listMediaForEvent(obj.eventId);
      }
      return [];
    })
  );
  ipcMain.handle(
    IPC_CHANNELS.MEDIA_DELETE,
    wrap(IPC_CHANNELS.MEDIA_DELETE, (id: string) => media.deleteMedia(assertId(id)))
  );
  ipcMain.handle(
    IPC_CHANNELS.MEDIA_SET_PRIMARY,
    wrap(IPC_CHANNELS.MEDIA_SET_PRIMARY, (personId, mediaId) => media.setPrimaryPhoto(assertId(personId, 'personId'), assertId(mediaId, 'mediaId')))
  );
  ipcMain.handle(
    IPC_CHANNELS.MEDIA_OPEN,
    wrap(IPC_CHANNELS.MEDIA_OPEN, (id: string) => media.openMedia(assertId(id)))
  );

  ipcMain.handle(
    IPC_CHANNELS.SOURCES_LIST,
    wrap(IPC_CHANNELS.SOURCES_LIST, () => sources.listSources())
  );
  ipcMain.handle(
    IPC_CHANNELS.SOURCES_CREATE,
    wrap(IPC_CHANNELS.SOURCES_CREATE, (input) => sources.createSource(assertPlainObject(input) as never))
  );
  ipcMain.handle(
    IPC_CHANNELS.SOURCES_UPDATE,
    wrap(IPC_CHANNELS.SOURCES_UPDATE, (input) => {
      const obj = assertPlainObject(input);
      assertId(obj.id);
      return sources.updateSource(obj as never);
    })
  );
  ipcMain.handle(
    IPC_CHANNELS.SOURCES_DELETE,
    wrap(IPC_CHANNELS.SOURCES_DELETE, (id: string) => sources.deleteSource(assertId(id)))
  );
  ipcMain.handle(
    IPC_CHANNELS.CITATIONS_LIST,
    wrap(IPC_CHANNELS.CITATIONS_LIST, (personId: string) => sources.listCitationsForPerson(assertId(personId, 'personId')))
  );
  ipcMain.handle(
    IPC_CHANNELS.CITATIONS_CREATE,
    wrap(IPC_CHANNELS.CITATIONS_CREATE, (input) => sources.createCitation(assertPlainObject(input) as never))
  );
  ipcMain.handle(
    IPC_CHANNELS.CITATIONS_DELETE,
    wrap(IPC_CHANNELS.CITATIONS_DELETE, (id: string) => sources.deleteCitation(assertId(id)))
  );

  ipcMain.handle(
    IPC_CHANNELS.TREE_GET,
    wrap(IPC_CHANNELS.TREE_GET, (personId?: string | null) => tree.getTree(assertOptionalId(personId, 'personId') ?? null))
  );

  ipcMain.handle(
    IPC_CHANNELS.PACK_EXPORT,
    wrap(IPC_CHANNELS.PACK_EXPORT, () => pack.exportProject())
  );
  ipcMain.handle(
    IPC_CHANNELS.PACK_IMPORT,
    wrap(IPC_CHANNELS.PACK_IMPORT, () => pack.importProject())
  );
  ipcMain.handle(
    IPC_CHANNELS.PACK_BACKUP,
    wrap(IPC_CHANNELS.PACK_BACKUP, () => pack.backupProject())
  );
  ipcMain.handle(
    IPC_CHANNELS.PACK_RESTORE,
    wrap(IPC_CHANNELS.PACK_RESTORE, () => pack.restoreProject())
  );
  ipcMain.handle(
    IPC_CHANNELS.PACK_SYNC_PREVIEW,
    wrap(IPC_CHANNELS.PACK_SYNC_PREVIEW, () => pack.previewSyncFromArchive())
  );
  ipcMain.handle(
    IPC_CHANNELS.PACK_SYNC_APPLY,
    wrap(IPC_CHANNELS.PACK_SYNC_APPLY, (archivePath: string, resolutions) =>
      pack.applySyncFromArchive(assertId(archivePath, 'archivePath'), resolutions)
    )
  );
  ipcMain.handle(
    IPC_CHANNELS.PACK_SYNC_PREVIEW_BATCH,
    wrap(IPC_CHANNELS.PACK_SYNC_PREVIEW_BATCH, () => pack.previewSyncFromArchives())
  );
  ipcMain.handle(
    IPC_CHANNELS.PACK_SYNC_APPLY_BATCH,
    wrap(IPC_CHANNELS.PACK_SYNC_APPLY_BATCH, (archivePaths: string[], resolutions) =>
      pack.applySyncFromArchives(assertStringArray(archivePaths, 'archivePaths'), resolutions)
    )
  );

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_GET,
    wrap(IPC_CHANNELS.SETTINGS_GET, () => settings.getSettings())
  );
  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_SET,
    wrap(IPC_CHANNELS.SETTINGS_SET, (partial) => {
      const result = settings.updateSettings(assertPlainObject(partial) as never);
      if ((partial as { locale?: unknown }).locale !== undefined) {
        applyAppLocale(result.locale);
      }
      return result;
    })
  );
  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_PICK_FOLDER,
    wrap(IPC_CHANNELS.SETTINGS_PICK_FOLDER, () => dialogs.pickFolder())
  );
  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_DEFAULT_BACKUP_FOLDER,
    wrap(IPC_CHANNELS.SETTINGS_DEFAULT_BACKUP_FOLDER, () => settings.getDefaultBackupFolder())
  );

  ipcMain.handle(
    IPC_CHANNELS.UNDO_PERFORM,
    wrap(IPC_CHANNELS.UNDO_PERFORM, () => undo.performUndo())
  );
  ipcMain.handle(
    IPC_CHANNELS.UNDO_CAN,
    wrap(IPC_CHANNELS.UNDO_CAN, () => undo.canUndo())
  );

  ipcMain.handle(
    IPC_CHANNELS.DIALOG_CONFIRM,
    wrap(IPC_CHANNELS.DIALOG_CONFIRM, (options) => dialogs.showConfirm(assertPlainObject(options) as never))
  );

  ipcMain.handle(
    IPC_CHANNELS.APP_COPY_DIAGNOSTICS,
    wrap(IPC_CHANNELS.APP_COPY_DIAGNOSTICS, () => copyDiagnosticsToClipboard())
  );
}
