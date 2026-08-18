import { describe, expect, it } from 'vitest'
import { isCloudSyncedPath, isDirectoryEmptyExcept } from './paths'

describe('isCloudSyncedPath', () => {
  it('detects Dropbox in path', () => {
    expect(isCloudSyncedPath('/Users/me/Dropbox/genealogy')).toBe(true)
  })

  it('detects OneDrive in path', () => {
    expect(isCloudSyncedPath('C:/Users/me/OneDrive/Projects/family')).toBe(true)
  })

  it('returns false for normal local path', () => {
    expect(isCloudSyncedPath('/Users/me/Documents/family-project')).toBe(false)
  })
})

describe('isDirectoryEmptyExcept', () => {
  it('allows dotfiles and whitelisted entries', () => {
    expect(isDirectoryEmptyExcept(['.DS_Store', 'media', 'thumbs'], ['media', 'thumbs'])).toBe(true)
  })

  it('rejects unexpected visible files', () => {
    expect(isDirectoryEmptyExcept(['readme.txt'], [])).toBe(false)
  })
})
