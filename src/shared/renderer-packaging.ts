import { extname, normalize, resolve, sep } from 'path';

/**
 * Vite emits `crossorigin` on module scripts/styles. Chromium treats that as a CORS
 * fetch; under Electron `loadFile` (file://, origin "null") the bundle never loads
 * → blank window. Strip at build time (`stripCrossoriginHtmlPlugin`).
 *
 * Production still must not rely on `file://` alone: on Windows (and some Intel Macs)
 * Chromium often fails to execute ES modules from asar over file://. Serve the
 * renderer over a privileged `app://` scheme with Node `fs` + explicit Content-Type
 * (not `net.fetch(file://)`, which often returns octet-stream → ESM refuses to run).
 */
export function stripCrossoriginAttributes(html: string): string {
  return html.replace(/\s+crossorigin(?:=["'][^"']*["'])?/gi, '');
}

const MIME_BY_EXT: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

/** Explicit MIME for protocol Responses — required so Chromium accepts ES modules. */
export function mimeTypeForPath(filePath: string): string {
  return MIME_BY_EXT[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Resolve a URL path under a local root directory (path-traversal safe).
 * Used by the `app://` renderer protocol and tests.
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
