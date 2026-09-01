import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppLocale } from '@shared/types';
import { applyDocumentLocale } from '@renderer/lib/document-locale';

describe('applyDocumentLocale', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets document.documentElement.lang', () => {
    const documentElement = { lang: '' };
    vi.stubGlobal('document', { documentElement });

    applyDocumentLocale('en');
    expect(documentElement.lang).toBe('en');

    applyDocumentLocale('it' as AppLocale);
    expect(documentElement.lang).toBe('it');
  });
});
