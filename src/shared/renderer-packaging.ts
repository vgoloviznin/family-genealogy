import { normalize, resolve, sep } from 'path';

/**
 * Vite emits `crossorigin` on module scripts/styles. Chromium treats that as a CORS
 * fetch; under Electron `loadFile` (file://, origin "null") the bundle never loads
 * → blank window on every platform (Windows 10 and macOS included).
 *
 * Fix: strip at build time (`stripCrossoriginHtmlPlugin`) and load with `loadFile`
 * + Vite `base: './'` — the electron-vite-recommended production path.
 */
export function stripCrossoriginAttributes(html: string): string {
  return html.replace(/\s+crossorigin(?:=["'][^"']*["'])?/gi, '');
}

/**
 * Resolve a URL path under a local root directory (path-traversal safe).
 * Kept for protocol handlers (e.g. family-media) and tests.
 */
export function resolveUnderRoot(rootDir: string, urlPathname: string): string | null {
  let pathname = urlPathname;
  if (!pathname || pathname === '/') {
    pathname = '/index.html';
  }
  const segments = pathname.split('/').filter(Boolean);
  if (segments.some((s) => s === '..' || s === '.')) {
    return null;
  }

  const root = resolve(rootDir);
  const candidate = resolve(root, `.${pathname}`);
  const prefix = root.endsWith(sep) ? root : root + sep;
  if (candidate !== root && !normalize(candidate).startsWith(prefix)) {
    return null;
  }
  return candidate;
}
