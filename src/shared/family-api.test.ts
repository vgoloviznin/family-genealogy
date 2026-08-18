import { describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from './types'
import { assertFamilyApi, createFamilyApi, FAMILY_API_METHODS } from './family-api'

describe('family preload API', () => {
  it('exposes linkSibling as a function that calls family:linkSibling', async () => {
    const invoke = vi.fn().mockResolvedValue(undefined)
    const family = createFamilyApi(invoke)

    expect(typeof family.linkSibling).toBe('function')
    expect(FAMILY_API_METHODS).toContain('linkSibling')
    expect(IPC_CHANNELS.FAMILY_LINK_SIBLING).toBe('family:linkSibling')

    await family.linkSibling('person-1', 'person-2')

    expect(invoke).toHaveBeenCalledWith('family:linkSibling', 'person-1', 'person-2', undefined)
  })

  it('exposes addSibling as a function that calls family:addSibling', async () => {
    const invoke = vi.fn().mockResolvedValue({ id: 'new' })
    const family = createFamilyApi(invoke)

    expect(typeof family.addSibling).toBe('function')
    await family.addSibling('person-1', { firstName: '', lastName: '' })

    expect(invoke).toHaveBeenCalledWith('family:addSibling', 'person-1', { firstName: '', lastName: '' }, undefined)
  })

  it('throws the runtime error when linkSibling is missing', () => {
    const incomplete = createFamilyApi(vi.fn())
    const broken = { ...incomplete, linkSibling: undefined }

    expect(() => assertFamilyApi(broken)).toThrow('window.api.family.linkSibling is not a function')
  })

  it('accepts a complete family API', () => {
    expect(() => assertFamilyApi(createFamilyApi(vi.fn()))).not.toThrow()
  })
})
