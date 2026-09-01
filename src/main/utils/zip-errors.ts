import { localizedError } from '../i18n';

export function zipError(key: string, params?: Record<string, string | number>): Error {
  return new Error(localizedError(key, params));
}
