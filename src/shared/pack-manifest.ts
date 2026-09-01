import { readFileSync } from 'fs';
import { translate, DEFAULT_LOCALE, type AppLocale } from './locales';

export const FGTREE_FORMAT = 'fgtree';

export interface PackManifest {
  format: string;
  formatVersion: number;
  kind: 'export' | 'backup';
  schemaVersion: number;
  projectId: string;
  projectName: string;
  sqliteSha256?: string;
  /** Optional merge metadata (not required by validatePackManifest). */
  exportedAt?: string;
  sourceDeviceId?: string;
  editorLabel?: string;
}

export function parsePackManifest(raw: string): unknown {
  return JSON.parse(raw);
}

export function validatePackManifest(manifest: unknown, locale: AppLocale = DEFAULT_LOCALE): PackManifest {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error(translate(locale, 'errors.invalidArchiveNoManifest'));
  }
  const record = manifest as Partial<PackManifest>;
  if (record.format !== FGTREE_FORMAT) {
    throw new Error(translate(locale, 'errors.invalidArchiveFormat'));
  }
  return record as PackManifest;
}

export async function verifyPackDatabaseHash(
  manifest: PackManifest,
  dbPath: string,
  sha256File: (path: string) => Promise<string>,
  locale: AppLocale = DEFAULT_LOCALE
): Promise<void> {
  const actualHash = await sha256File(dbPath);
  if (manifest.sqliteSha256 && manifest.sqliteSha256 !== actualHash) {
    throw new Error(translate(locale, 'errors.dbHashMismatch'));
  }
}

export function readPackManifest(manifestPath: string, locale: AppLocale = DEFAULT_LOCALE): PackManifest {
  return validatePackManifest(parsePackManifest(readFileSync(manifestPath, 'utf-8')), locale);
}
