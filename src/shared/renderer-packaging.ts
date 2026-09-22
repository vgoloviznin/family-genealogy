import { normalize, resolve, sep } from 'path';

/**
 * Vite emits `crossorigin` on module scripts/styles. Chromium treats that as a CORS
 * fetch; under Electron `loadFile` (file://, origin "null") the bundle never loads
 * → blank window on every platform.
 */
export function stripCrossoriginAttributes(html: string): string {
  return html.replace(/\s+crossorigin(?:=["'][^"']*["'])?/gi, '');
}

/**
 * Map family-app://localhost/... request URLs onto files under the renderer root.
 * Returns null when the path escapes the root (traversal).
 */
export function resolveAppProtocolPath(rendererRoot: string, requestUrl: string): string | null {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(requestUrl).pathname);
  } catch {
    return null;
  }
  if (!pathname || pathname === '/') {
    pathname = '/index.html';
  }
  // Reject any remaining ".." segments (e.g. after %2e%2e decoding).
  const segments = pathname.split('/').filter(Boolean);
  if (segments.some((s) => s === '..' || s === '.')) {
    return null;
  }

  const root = resolve(rendererRoot);
  const candidate = resolve(root, `.${pathname}`);
  const prefix = root.endsWith(sep) ? root : root + sep;
  if (candidate !== root && !normalize(candidate).startsWith(prefix)) {
    return null;
  }
  return candidate;
}
