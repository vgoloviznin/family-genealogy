import Database from 'better-sqlite3';

let cached: boolean | null = null;

export function isSqliteAvailable(): boolean {
  if (cached != null) {
    return cached;
  }
  try {
    const db = new Database(':memory:');
    db.close();
    cached = true;
  } catch {
    cached = false;
  }
  return cached;
}
