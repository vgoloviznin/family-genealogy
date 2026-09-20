import { existsSync } from 'node:fs'
import { join } from 'node:path'

/** Platform packages sharp needs for macOS arm64 + Intel DMGs. */
export const SHARP_DARWIN_PACKAGES = [
  '@img/sharp-darwin-arm64',
  '@img/sharp-darwin-x64',
  '@img/sharp-libvips-darwin-arm64',
  '@img/sharp-libvips-darwin-x64'
]

/**
 * @param {string} nodeModulesDir absolute or cwd-relative path to node_modules
 * @returns {string[]} missing package names (with @img/… scope)
 */
export function missingSharpDarwinPackages(nodeModulesDir) {
  return SHARP_DARWIN_PACKAGES.filter((name) => !existsSync(join(nodeModulesDir, name)))
}

/**
 * Which sharp darwin runtime packages a packaged .app must include.
 * @param {string} electronBinaryArch from `lipo -archs` (e.g. "arm64", "x86_64", or both)
 * @returns {string[]}
 */
export function requiredSharpDarwinPackagesForArch(electronBinaryArch) {
  const archs = new Set(electronBinaryArch.trim().split(/\s+/).filter(Boolean))
  /** @type {string[]} */
  const required = []
  if (archs.has('arm64')) required.push('@img/sharp-darwin-arm64')
  if (archs.has('x86_64')) required.push('@img/sharp-darwin-x64')
  return required
}
