import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import {
  mimeTypeForPath,
  resolveRendererRoot,
  resolveUnderRoot,
  rendererResponseHeaders,
  stripCrossoriginAttributes
} from '@shared/renderer-packaging';

describe('stripCrossoriginAttributes', () => {
  it('removes bare and valued crossorigin attributes', () => {
    const html =
      '<script type="module" crossorigin src="./assets/a.js"></script>' + '<link rel="stylesheet" crossorigin="anonymous" href="./assets/a.css">';
    expect(stripCrossoriginAttributes(html)).toBe(
      '<script type="module" src="./assets/a.js"></script>' + '<link rel="stylesheet" href="./assets/a.css">'
    );
  });

  it('is a no-op when crossorigin is absent', () => {
    const html = '<script type="module" src="./assets/a.js"></script>';
    expect(stripCrossoriginAttributes(html)).toBe(html);
  });
});

describe('mimeTypeForPath', () => {
  it('returns javascript MIME for ES module assets', () => {
    expect(mimeTypeForPath('/out/renderer/assets/index-abc.js')).toBe('text/javascript; charset=utf-8');
  });

  it('returns html and css MIME types', () => {
    expect(mimeTypeForPath('/out/renderer/index.html')).toBe('text/html; charset=utf-8');
    expect(mimeTypeForPath('/out/renderer/assets/index.css')).toBe('text/css; charset=utf-8');
  });

  it('falls back to octet-stream for unknown extensions', () => {
    expect(mimeTypeForPath('/out/renderer/assets/x.bin')).toBe('application/octet-stream');
  });
});

describe('rendererResponseHeaders', () => {
  it('sets Content-Type, Content-Length, and CORS for ESM', () => {
    expect(rendererResponseHeaders('/x/assets/a.js', 42)).toEqual({
      'Content-Type': 'text/javascript; charset=utf-8',
      'Content-Length': '42',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
  });
});

describe('resolveRendererRoot', () => {
  it('uses ../renderer in development', () => {
    expect(
      resolveRendererRoot({
        dirname: '/app/out/main',
        resourcesPath: '/app/resources',
        isPackaged: false,
        indexExists: () => false
      })
    ).toBe(join('/app/out/main', '../renderer'));
  });

  it('prefers app.asar.unpacked when index exists there', () => {
    const resourcesPath = '/Apps/Family Genealogy/resources';
    const unpacked = join(resourcesPath, 'app.asar.unpacked', 'out', 'renderer', 'index.html');
    expect(
      resolveRendererRoot({
        dirname: join(resourcesPath, 'app.asar', 'out', 'main'),
        resourcesPath,
        isPackaged: true,
        indexExists: (p) => p === unpacked
      })
    ).toBe(join(resourcesPath, 'app.asar.unpacked', 'out', 'renderer'));
  });

  it('falls back to asar sibling when unpacked index is missing', () => {
    expect(
      resolveRendererRoot({
        dirname: '/resources/app.asar/out/main',
        resourcesPath: '/resources',
        isPackaged: true,
        indexExists: () => false
      })
    ).toBe(join('/resources/app.asar/out/main', '../renderer'));
  });
});

describe('resolveUnderRoot', () => {
  const root = '/app/out/renderer';

  it('maps index and asset paths under the root', () => {
    expect(resolveUnderRoot(root, '/')).toBe(resolve(root, 'index.html'));
    expect(resolveUnderRoot(root, '/index.html')).toBe(resolve(root, 'index.html'));
    expect(resolveUnderRoot(root, '/assets/app.js')).toBe(resolve(root, 'assets/app.js'));
  });

  it('rejects path traversal', () => {
    expect(resolveUnderRoot(root, '/foo/../secret')).toBeNull();
  });
});
