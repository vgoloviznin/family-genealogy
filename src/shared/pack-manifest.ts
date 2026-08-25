import { readFileSync } from 'fs';

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

export function validatePackManifest(manifest: unknown): PackManifest {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Неверный файл: нет manifest.json');
  }
  const record = manifest as Partial<PackManifest>;
  if (record.format !== FGTREE_FORMAT) {
    throw new Error('Неверный формат архива');
  }
  return record as PackManifest;
}

export async function verifyPackDatabaseHash(manifest: PackManifest, dbPath: string, sha256File: (path: string) => Promise<string>): Promise<void> {
  const actualHash = await sha256File(dbPath);
  if (manifest.sqliteSha256 && manifest.sqliteSha256 !== actualHash) {
    throw new Error('Кontрольная сумма базы данных не совпадает');
  }
}

export function readPackManifest(manifestPath: string): PackManifest {
  return validatePackManifest(parsePackManifest(readFileSync(manifestPath, 'utf-8')));
}
