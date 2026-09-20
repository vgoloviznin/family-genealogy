/**
 * After electron-builder --mac --arm64 --x64, assert each .app embeds the matching sharp binary.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { requiredSharpDarwinPackagesForArch } from './sharp-darwin-binaries.mjs'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const releaseDir = join(root, 'release')
const appName = 'Family Genealogy.app'

function findApps(dir, found = []) {
  if (!existsSync(dir)) return found
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (!st.isDirectory()) continue
    if (name === appName) found.push(full)
    else findApps(full, found)
  }
  return found
}

function lipoArchs(binaryPath) {
  return execFileSync('lipo', ['-archs', binaryPath], { encoding: 'utf8' }).trim()
}

const apps = findApps(releaseDir)
if (apps.length === 0) {
  console.error(`No ${appName} found under release/`)
  process.exit(1)
}

const seen = new Set()
for (const app of apps) {
  const binary = join(app, 'Contents/MacOS/Family Genealogy')
  if (!existsSync(binary)) {
    console.error(`Missing executable: ${binary}`)
    process.exit(1)
  }
  const archs = lipoArchs(binary)
  const required = requiredSharpDarwinPackagesForArch(archs)
  if (required.length === 0) {
    console.error(`Unsupported Electron arch(s) in ${app}: ${archs}`)
    process.exit(1)
  }
  for (const pkg of required) {
    const pkgDir = join(app, 'Contents/Resources/app.asar.unpacked/node_modules', pkg)
    if (!existsSync(pkgDir)) {
      console.error(`Packaged app missing ${pkg}\n  app: ${app}\n  arch: ${archs}`)
      process.exit(1)
    }
    console.log(`ok ${archs} → ${pkg} (${app})`)
    seen.add(pkg)
  }
}

for (const need of ['@img/sharp-darwin-arm64', '@img/sharp-darwin-x64']) {
  if (!seen.has(need)) {
    console.error(`Expected a packaged app with ${need}, found only: ${[...seen].join(', ') || '(none)'}`)
    process.exit(1)
  }
}

console.log('packaged sharp darwin binaries verified')
