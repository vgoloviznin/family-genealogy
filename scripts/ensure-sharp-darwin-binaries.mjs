/**
 * npm ci on an arm64 host only installs @img/sharp-darwin-arm64.
 * Intel macOS DMGs need @img/sharp-darwin-x64 in the same tree before electron-builder.
 * @see https://sharp.pixelplumbing.com/install#cross-platform
 */
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { missingSharpDarwinPackages } from './sharp-darwin-binaries.mjs'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const nodeModules = join(root, 'node_modules')

let missing = missingSharpDarwinPackages(nodeModules)
if (missing.length === 0) {
  console.log('sharp darwin arm64 + x64 binaries already present')
  process.exit(0)
}

console.log(`Installing sharp for both darwin arches (missing: ${missing.join(', ')})`)
execSync('npm install --no-save --cpu=x64 --os=darwin sharp', { cwd: root, stdio: 'inherit' })
execSync('npm install --no-save --cpu=arm64 --os=darwin sharp', { cwd: root, stdio: 'inherit' })

missing = missingSharpDarwinPackages(nodeModules)
if (missing.length > 0) {
  console.error(`sharp darwin packages still missing: ${missing.join(', ')}`)
  process.exit(1)
}

console.log('sharp darwin arm64 + x64 binaries ready')
