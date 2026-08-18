import { IPC_CHANNELS } from './types'
import type { Api } from './types'

export const FAMILY_API_METHODS = [
  'addPartner',
  'addChild',
  'addParents',
  'addSibling',
  'getForPerson',
  'linkPartner',
  'linkChild',
  'linkParent',
  'linkSibling',
  'linkPartnerToFamily',
  'linkChildToFamily',
  'unlinkPartner',
  'unlinkChild',
  'setUnionType',
  'setPedigree'
] as const satisfies ReadonlyArray<keyof Api['family']>

type Invoke = (channel: string, ...args: unknown[]) => Promise<unknown>

export function createFamilyApi(invoke: Invoke): Api['family'] {
  return {
    addPartner: (personId, input, unionType) =>
      invoke(IPC_CHANNELS.FAMILY_ADD_PARTNER, personId, input, unionType) as ReturnType<Api['family']['addPartner']>,
    addChild: (personId, input, pedigree) =>
      invoke(IPC_CHANNELS.FAMILY_ADD_CHILD, personId, input, pedigree) as ReturnType<Api['family']['addChild']>,
    addParents: (personId, inputs, pedigree) =>
      invoke(IPC_CHANNELS.FAMILY_ADD_PARENTS, personId, inputs, pedigree) as ReturnType<Api['family']['addParents']>,
    addSibling: (personId, input, pedigree) =>
      invoke(IPC_CHANNELS.FAMILY_ADD_SIBLING, personId, input, pedigree) as ReturnType<Api['family']['addSibling']>,
    getForPerson: (personId) =>
      invoke(IPC_CHANNELS.FAMILY_GET_FOR_PERSON, personId) as ReturnType<Api['family']['getForPerson']>,
    linkPartner: (personId, partnerId, unionType) =>
      invoke(IPC_CHANNELS.FAMILY_LINK_PARTNER, personId, partnerId, unionType) as ReturnType<Api['family']['linkPartner']>,
    linkChild: (personId, childId, pedigree) =>
      invoke(IPC_CHANNELS.FAMILY_LINK_CHILD, personId, childId, pedigree) as ReturnType<Api['family']['linkChild']>,
    linkParent: (personId, parentId, pedigree) =>
      invoke(IPC_CHANNELS.FAMILY_LINK_PARENT, personId, parentId, pedigree) as ReturnType<Api['family']['linkParent']>,
    linkSibling: (personId, siblingId, pedigree) =>
      invoke(IPC_CHANNELS.FAMILY_LINK_SIBLING, personId, siblingId, pedigree) as ReturnType<Api['family']['linkSibling']>,
    linkPartnerToFamily: (familyId, personId) =>
      invoke(IPC_CHANNELS.FAMILY_LINK_PARTNER_TO_FAMILY, familyId, personId) as ReturnType<Api['family']['linkPartnerToFamily']>,
    linkChildToFamily: (familyId, childId, pedigree) =>
      invoke(IPC_CHANNELS.FAMILY_LINK_CHILD_TO_FAMILY, familyId, childId, pedigree) as ReturnType<
        Api['family']['linkChildToFamily']
      >,
    unlinkPartner: (familyId, personId) =>
      invoke(IPC_CHANNELS.FAMILY_UNLINK_PARTNER, familyId, personId) as ReturnType<Api['family']['unlinkPartner']>,
    unlinkChild: (familyId, personId) =>
      invoke(IPC_CHANNELS.FAMILY_UNLINK_CHILD, familyId, personId) as ReturnType<Api['family']['unlinkChild']>,
    setUnionType: (familyId, unionType) =>
      invoke(IPC_CHANNELS.FAMILY_SET_UNION_TYPE, familyId, unionType) as ReturnType<Api['family']['setUnionType']>,
    setPedigree: (familyId, childId, pedigree) =>
      invoke(IPC_CHANNELS.FAMILY_SET_PEDIGREE, familyId, childId, pedigree) as ReturnType<Api['family']['setPedigree']>
  }
}

export function assertFamilyApi(family: Partial<Api['family']> | undefined): void {
  if (!family) throw new Error('window.api.family is not defined')
  for (const method of FAMILY_API_METHODS) {
    if (typeof family[method] !== 'function') {
      throw new Error(`window.api.family.${method} is not a function`)
    }
  }
}
