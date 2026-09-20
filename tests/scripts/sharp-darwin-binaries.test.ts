import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  SHARP_DARWIN_PACKAGES,
  missingSharpDarwinPackages,
  requiredSharpDarwinPackagesForArch
} from '../../scripts/sharp-darwin-binaries.mjs'

describe('sharp darwin packaging helpers', () => {
  const temps: string[] = []

  afterEach(() => {
    for (const dir of temps) rmSync(dir, { recursive: true, force: true })
    temps.length = 0
  })

  it('lists all four darwin platform packages', () => {
    expect(SHARP_DARWIN_PACKAGES).toEqual([
      '@img/sharp-darwin-arm64',
      '@img/sharp-darwin-x64',
      '@img/sharp-libvips-darwin-arm64',
      '@img/sharp-libvips-darwin-x64'
    ])
  })

  it('reports missing packages under node_modules', () => {
    const root = mkdtempSync(join(tmpdir(), 'sharp-darwin-'))
    temps.push(root)
    mkdirSync(join(root, '@img/sharp-darwin-arm64'), { recursive: true })
    writeFileSync(join(root, '@img/sharp-darwin-arm64/package.json'), '{}')

    expect(missingSharpDarwinPackages(root)).toEqual([
      '@img/sharp-darwin-x64',
      '@img/sharp-libvips-darwin-arm64',
      '@img/sharp-libvips-darwin-x64'
    ])
  })

  it('maps Electron lipo arch to the required sharp package', () => {
    expect(requiredSharpDarwinPackagesForArch('arm64')).toEqual(['@img/sharp-darwin-arm64'])
    expect(requiredSharpDarwinPackagesForArch('x86_64')).toEqual(['@img/sharp-darwin-x64'])
    expect(requiredSharpDarwinPackagesForArch('arm64 x86_64')).toEqual([
      '@img/sharp-darwin-arm64',
      '@img/sharp-darwin-x64'
    ])
    expect(requiredSharpDarwinPackagesForArch('ppc')).toEqual([])
  })
})
