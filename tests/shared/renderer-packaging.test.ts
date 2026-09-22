import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { resolveAppProtocolPath, stripCrossoriginAttributes } from '@shared/renderer-packaging';

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

describe('resolveAppProtocolPath', () => {
  const root = '/app/out/renderer';

  it('maps index and asset paths under the renderer root', () => {
    expect(resolveAppProtocolPath(root, 'family-app://localhost/')).toBe(resolve(root, 'index.html'));
    expect(resolveAppProtocolPath(root, 'family-app://localhost/index.html')).toBe(resolve(root, 'index.html'));
    expect(resolveAppProtocolPath(root, 'family-app://localhost/assets/app.js')).toBe(resolve(root, 'assets/app.js'));
  });

  it('rejects path traversal', () => {
    // Encoded slash keeps ".." as a path segment after decodeURIComponent.
    expect(resolveAppProtocolPath(root, 'family-app://localhost/foo/%2e%2e%2f/secret')).toBeNull();
  });
});
