import { logError } from '../utils/log';
import { localizedError } from '../i18n';
import type { PedigreeType, UnionType, CreatePersonInput } from '@shared/types';

const PEDIGREES = new Set<PedigreeType>(['birth', 'adopted', 'step', 'foster']);
const UNION_TYPES = new Set<UnionType>(['marriage', 'partnership', 'unknown']);

export function wrap<T extends unknown[], R>(channel: string, fn: (...args: T) => Promise<R> | R) {
  return async (_event: Electron.IpcMainInvokeEvent, ...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (err) {
      logError(`ipc:${channel}`, err);
      throw err;
    }
  };
}

export function assertId(value: unknown, label = 'id'): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(localizedError('errors.invalidIpcArgument', { label }));
  }
  return value;
}

export function assertPlainObject(value: unknown, label = 'input'): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(localizedError('errors.invalidIpcArgument', { label }));
  }
  return value as Record<string, unknown>;
}

export function assertOptionalId(value: unknown, label = 'id'): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return assertId(value, label);
}

export function assertFamilyIdOrNew(value: unknown): string | 'new' | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (value === 'new') {
    return 'new';
  }
  return assertId(value, 'familyId');
}

export function assertOptionalPedigree(value: unknown): PedigreeType | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value !== 'string' || !PEDIGREES.has(value as PedigreeType)) {
    throw new Error(localizedError('errors.invalidIpcArgument', { label: 'pedigree' }));
  }
  return value as PedigreeType;
}

export function assertPedigree(value: unknown): PedigreeType {
  return assertOptionalPedigree(value) ?? 'birth';
}

export function assertOptionalUnionType(value: unknown): UnionType | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value !== 'string' || !UNION_TYPES.has(value as UnionType)) {
    throw new Error(localizedError('errors.invalidIpcArgument', { label: 'unionType' }));
  }
  return value as UnionType;
}

export function assertUnionType(value: unknown): UnionType {
  const unionType = assertOptionalUnionType(value);
  if (!unionType) {
    throw new Error(localizedError('errors.invalidIpcArgument', { label: 'unionType' }));
  }
  return unionType;
}

export function assertParentInputs(value: unknown): [CreatePersonInput, CreatePersonInput?] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 2) {
    throw new Error(localizedError('errors.invalidIpcArgument', { label: 'parents' }));
  }
  assertPlainObject(value[0], 'parent0');
  if (value[1] !== undefined && value[1] !== null) {
    assertPlainObject(value[1], 'parent1');
  }
  return value as [CreatePersonInput, CreatePersonInput?];
}

export function assertStringArray(value: unknown, label = 'paths'): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(localizedError('errors.invalidIpcArgument', { label }));
  }
  return value;
}
