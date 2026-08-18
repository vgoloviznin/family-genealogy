import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestProjectDir } from '../test/project-fixture'
import { isSqliteAvailable } from '../test/sqlite-available'
import { closeProject } from './project'
import { createPerson } from './people'
import {
  addChildToPerson,
  addPartner,
  addSibling,
  getFamiliesForPerson,
  linkExistingPartner,
  linkExistingSibling,
  unlinkPartner
} from './family'

vi.mock('./settings', () => ({
  getDeviceMeta: () => ({ deviceId: 'test-device', label: 'tester' }),
  getSettings: () => ({
    deviceId: 'test-device',
    editorLabel: '',
    backupOnQuit: false,
    backupKeepCount: 10,
    recentProjects: []
  }),
  addRecentProject: vi.fn(),
  pruneRecentProjects: vi.fn()
}))

describe.skipIf(!isSqliteAvailable())('family service', () => {
  afterEach(() => {
    closeProject()
  })

  it('adds a partner to a new marriage family', async () => {
    const project = createTestProjectDir()
    try {
      const person = await createPerson({ firstName: 'Ivan', lastName: 'Ivanov' })
      const partner = await addPartner(person.id, { firstName: 'Maria', lastName: 'Ivanova' })

      const families = await getFamiliesForPerson(person.id)
      expect(families).toHaveLength(1)
      expect(families[0].partners.map((p) => p.id).sort()).toEqual([person.id, partner.id].sort())
    } finally {
      project.cleanup()
    }
  })

  it('adds a child under the parent family', async () => {
    const project = createTestProjectDir()
    try {
      const parent = await createPerson({ firstName: 'Parent', lastName: 'One' })
      const child = await addChildToPerson(parent.id, { firstName: 'Child', lastName: 'One' })

      const families = await getFamiliesForPerson(parent.id)
      expect(families[0].children.map((c) => c.person.id)).toContain(child.id)
    } finally {
      project.cleanup()
    }
  })

  it('places siblings in the same family', async () => {
    const project = createTestProjectDir()
    try {
      const first = await createPerson({ firstName: 'First', lastName: 'Sibling' })
      const second = await addSibling(first.id, { firstName: 'Second', lastName: 'Sibling' })

      const families = await getFamiliesForPerson(first.id)
      expect(families[0].children.map((c) => c.person.id).sort()).toEqual([first.id, second.id].sort())
    } finally {
      project.cleanup()
    }
  })

  it('links an existing person as sibling', async () => {
    const project = createTestProjectDir()
    try {
      const first = await createPerson({ firstName: 'Anna', lastName: 'A' })
      const second = await createPerson({ firstName: 'Boris', lastName: 'B' })
      await linkExistingSibling(first.id, second.id)

      const families = await getFamiliesForPerson(first.id)
      expect(families[0].children.map((c) => c.person.id).sort()).toEqual([first.id, second.id].sort())
    } finally {
      project.cleanup()
    }
  })

  it('rejects linking a person as their own partner or sibling', async () => {
    const project = createTestProjectDir()
    try {
      const person = await createPerson({ firstName: 'Solo', lastName: 'Person' })
      await expect(linkExistingPartner(person.id, person.id)).rejects.toThrow('с самим собой')
      await expect(linkExistingSibling(person.id, person.id)).rejects.toThrow('своим братом или сестрой')
    } finally {
      project.cleanup()
    }
  })

  it('rejects duplicate partner links', async () => {
    const project = createTestProjectDir()
    try {
      const person = await createPerson({ firstName: 'One', lastName: 'Person' })
      const partner = await createPerson({ firstName: 'Two', lastName: 'Person' })
      await linkExistingPartner(person.id, partner.id)
      await expect(linkExistingPartner(person.id, partner.id)).rejects.toThrow('уже супруги')
    } finally {
      project.cleanup()
    }
  })

  it('soft-unlinks a partner from a family', async () => {
    const project = createTestProjectDir()
    try {
      const person = await createPerson({ firstName: 'Alex', lastName: 'A' })
      const partner = await addPartner(person.id, { firstName: 'Nina', lastName: 'B' })
      const familyId = (await getFamiliesForPerson(person.id))[0].id

      await unlinkPartner(familyId, partner.id)
      const after = await getFamiliesForPerson(person.id)
      expect(after[0].partners.map((p) => p.id)).toEqual([person.id])
    } finally {
      project.cleanup()
    }
  })
})
