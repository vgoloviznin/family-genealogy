import type { UndoAction } from '@shared/types'
import * as people from './people'
import * as family from './family'
import * as sources from './sources'

const MAX_UNDO = 5
const stack: UndoAction[] = []

export function pushUndo(action: UndoAction): void {
  stack.push(action)
  if (stack.length > MAX_UNDO) stack.shift()
}

export function popUndo(): UndoAction | null {
  return stack.pop() ?? null
}

export function canUndo(): boolean {
  return stack.length > 0
}

export function clearUndo(): void {
  stack.length = 0
}

export async function performUndo(): Promise<UndoAction | null> {
  const action = popUndo()
  if (!action) return null

  switch (action.type) {
    case 'person-update':
      await people.updatePerson(action.before)
      break
    case 'person-undelete':
      await people.restorePerson(action.id)
      break
    case 'event-delete':
      await people.deleteEvent(action.id)
      break
    case 'event-restore':
      await people.restoreEvent(action.event)
      break
    case 'family-unlink-partner':
      await family.unlinkPartner(action.familyId, action.personId)
      break
    case 'family-unlink-child':
      await family.unlinkChild(action.familyId, action.personId)
      break
    case 'family-relink-partner':
      await family.relinkPartner(action.familyId, action.personId)
      break
    case 'family-relink-child':
      await family.relinkChild(action.familyId, action.personId, action.pedigree)
      break
    case 'citation-delete':
      await sources.deleteCitation(action.id)
      break
    case 'citation-restore':
      await sources.restoreCitation(action.id)
      break
    default:
      break
  }
  return action
}
