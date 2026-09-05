import type { UndoAction } from '@shared/types';
import { withSqliteTransaction } from '../db/connection';
import * as people from './people';
import * as family from './family';
import * as sources from './sources';
import { takeUndoStep, runWithUndoDepth } from './undo-stack';

export { recordUndo, withUndoSuppressed, canUndo, clearUndo, getUndoStackLength } from './undo-stack';

export async function performUndo(): Promise<UndoAction | null> {
  const step = takeUndoStep();
  if (!step || step.length === 0) {
    return null;
  }

  await withSqliteTransaction(() =>
    runWithUndoDepth(async () => {
      for (let i = step.length - 1; i >= 0; i--) {
        await applyInversion(step[i]!);
      }
    })
  );
  return step[0] ?? null;
}

async function applyInversion(action: UndoAction): Promise<void> {
  switch (action.type) {
    case 'person-update':
      await people.updatePerson(action.before);
      break;
    case 'person-undelete':
      await people.restorePerson(action.id);
      break;
    case 'person-delete':
      await people.deletePerson(action.id);
      break;
    case 'event-delete':
      await people.deleteEvent(action.id);
      break;
    case 'event-restore':
      await people.restoreEvent(action.event);
      break;
    case 'family-unlink-partner':
      await family.unlinkPartner(action.familyId, action.personId);
      break;
    case 'family-unlink-child':
      await family.unlinkChild(action.familyId, action.personId);
      break;
    case 'family-relink-partner':
      await family.relinkPartner(action.familyId, action.personId);
      break;
    case 'family-relink-child':
      await family.relinkChild(action.familyId, action.personId, action.pedigree);
      break;
    case 'citation-delete':
      await sources.deleteCitation(action.id);
      break;
    case 'citation-restore':
      await sources.restoreCitation(action.id);
      break;
    default:
      break;
  }
}
