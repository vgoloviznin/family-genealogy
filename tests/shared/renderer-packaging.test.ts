import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { resolveUnderRoot, stripCrossoriginAttributes } from '@shared/renderer-packaging';

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
