/**
 * Fail the build if the packaged renderer HTML still has crossorigin attributes
 * (silent blank window under Electron file:// / incomplete CORS).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const indexPath = join(process.cwd(), 'out/renderer/index.html');
if (!existsSync(indexPath)) {
  console.error(`Missing ${indexPath} — run electron-vite build first`);
  process.exit(1);
}

const html = readFileSync(indexPath, 'utf8');
if (/\scrossorigin\b/i.test(html)) {
  console.error('Renderer index.html still contains crossorigin — ES modules will not load in Electron.');
  console.error(html);
  process.exit(1);
}

if (!/<script\s+type="module"\s+src="\.\/assets\//i.test(html)) {
  console.error('Renderer index.html is missing the expected module script tag.');
  console.error(html);
  process.exit(1);
}

console.log('renderer packaging ok (no crossorigin)');
