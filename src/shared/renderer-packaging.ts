import { extname, join, normalize, resolve, sep } from 'path';

/**
 * Vite emits `crossorigin` on module scripts/styles. Chromium treats that as a CORS
 * fetch; under Electron `loadFile` (file://, origin "null") the bundle never loads
 * → blank window. Strip at build time (`stripCrossoriginHtmlPlugin`).
 *
 * Production must not rely on `file://` into asar: Chromium often cannot run ES
 * modules from asar paths (Windows especially). Serve over privileged `app://` from
 * the real on-disk tree (`app.asar.unpacked/out/renderer` when packaged) with Node
 * `fs` + explicit MIME — never `net.fetch(file://)` for the UI (often octet-stream).
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
 * Packaged builds unpack the renderer (`asarUnpack: out/renderer/**`). Prefer that
 * real filesystem path so protocol handlers never depend on asar path rewriting
 * (unreliable for Chromium / some Windows Electron fs edge cases).
 */
export function resolveRendererRoot(options: {
  dirname: string;
  resourcesPath: string;
  isPackaged: boolean;
  indexExists: (filePath: string) => boolean;
}): string {
  const devOrAsarSibling = join(options.dirname, '../renderer');
  if (!options.isPackaged) {
    return devOrAsarSibling;
  }

  const unpacked = join(options.resourcesPath, 'app.asar.unpacked', 'out', 'renderer');
  if (options.indexExists(join(unpacked, 'index.html'))) {
    return unpacked;
  }

  // Legacy / non-unpacked builds: still under app.asar/out/renderer via Electron fs.
  return devOrAsarSibling;
}

/** Headers for `app://` Responses (ESM + optional CORS on privileged schemes). */
export function rendererResponseHeaders(filePath: string, byteLength: number): Record<string, string> {
  return {
    'Content-Type': mimeTypeForPath(filePath),
    'Content-Length': String(byteLength),
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache'
  };
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
