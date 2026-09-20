import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('electron-builder sharp packaging config', () => {
  it('unpacks sharp and @img native packages from asar', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      build: { asarUnpack: string[] };
    };
    expect(pkg.build.asarUnpack.some((p) => p.includes('sharp'))).toBe(true);
    expect(pkg.build.asarUnpack.some((p) => p.includes('@img'))).toBe(true);
  });
});
