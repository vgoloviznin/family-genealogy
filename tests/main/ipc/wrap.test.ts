import { describe, expect, it, vi } from 'vitest';
import { wrap, assertId, assertPlainObject, assertParentInputs, assertFamilyIdOrNew, assertStringArray } from '@main/ipc/wrap';
import { localizedErrorMessage } from '../../helpers/localized-error';
import { logError } from '@main/utils/log';

vi.mock('@main/utils/log', () => ({
  logError: vi.fn(),
  logInfo: vi.fn()
}));

describe('ipc wrap', () => {
  it('rethrows after invoking handler', async () => {
    const handler = wrap('test:ok', async (n: number) => n + 1);
    await expect(handler({} as never, 2)).resolves.toBe(3);
  });

  it('logs and rethrows errors from handler', async () => {
    const handler = wrap('test:fail', async () => {
      throw new Error('boom');
    });
    await expect(handler({} as never)).rejects.toThrow('boom');
    expect(logError).toHaveBeenCalledWith('ipc:test:fail', expect.any(Error));
  });

  it('assertId rejects empty values', () => {
    expect(() => assertId('')).toThrow(localizedErrorMessage('errors.invalidIpcArgument', { label: 'id' }));
    expect(assertId('abc')).toBe('abc');
  });

  it('assertPlainObject rejects arrays and null', () => {
    expect(() => assertPlainObject(null)).toThrow(localizedErrorMessage('errors.invalidIpcArgument', { label: 'input' }));
    expect(() => assertPlainObject([])).toThrow(localizedErrorMessage('errors.invalidIpcArgument', { label: 'input' }));
    expect(assertPlainObject({ a: 1 })).toEqual({ a: 1 });
  });

  it('assertParentInputs requires 1–2 objects', () => {
    expect(() => assertParentInputs('nope')).toThrow(localizedErrorMessage('errors.invalidIpcArgument', { label: 'parents' }));
    expect(() => assertParentInputs([])).toThrow(localizedErrorMessage('errors.invalidIpcArgument', { label: 'parents' }));
    expect(assertParentInputs([{ firstName: 'A', lastName: 'B' }])[0]).toEqual({ firstName: 'A', lastName: 'B' });
  });

  it('assertFamilyIdOrNew accepts new or id', () => {
    expect(assertFamilyIdOrNew(undefined)).toBeUndefined();
    expect(assertFamilyIdOrNew('new')).toBe('new');
    expect(assertFamilyIdOrNew('fam-1')).toBe('fam-1');
    expect(() => assertFamilyIdOrNew(1)).toThrow(localizedErrorMessage('errors.invalidIpcArgument', { label: 'familyId' }));
  });

  it('assertStringArray rejects non-string items', () => {
    expect(() => assertStringArray('x', 'archivePaths')).toThrow(
      localizedErrorMessage('errors.invalidIpcArgument', { label: 'archivePaths' })
    );
    expect(assertStringArray(['/a.fgtree'], 'archivePaths')).toEqual(['/a.fgtree']);
  });
});
