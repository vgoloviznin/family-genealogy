import { createWriteStream, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ZipArchive } from 'archiver';
import { describe, expect, it } from 'vitest';
import { extractZip } from '@main/utils/safe-extract-zip';

async function createZip(archivePath: string, entries: Array<{ name: string; content: string }>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(archivePath);
    const archive = new ZipArchive({ zlib: { level: 6 } });

    output.on('close', () => resolve());
    archive.on('error', reject);
    archive.pipe(output);

    for (const entry of entries) {
      archive.append(entry.content, { name: entry.name });
    }

    void archive.finalize();
  });
}

describe('safe-extract-zip', () => {
  it('extracts regular zip entries', async () => {
    const root = mkdtempSync(join(tmpdir(), 'fgtree-zip-ok-'));
    const archivePath = join(root, 'archive.zip');
    const destDir = join(root, 'out');

    try {
      await createZip(archivePath, [
        { name: 'hello.txt', content: 'hello' },
        { name: 'nested/dir/file.txt', content: 'nested' }
      ]);

      await extractZip(archivePath, { dir: destDir });

      expect(readFileSync(join(destDir, 'hello.txt'), 'utf-8')).toBe('hello');
      expect(readFileSync(join(destDir, 'nested/dir/file.txt'), 'utf-8')).toBe('nested');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects zip slip entries', async () => {
    const root = mkdtempSync(join(tmpdir(), 'fgtree-zip-slip-'));
    const archivePath = join(root, 'evil.zip');
    const destDir = join(root, 'out');

    try {
      writeFileSync(
        archivePath,
        Buffer.from(
          'UEsDBAoAAAAAAKCoHF37XrOFBgAAAAYAAAAOABwALi4vb3V0c2lkZS50eHRVVAkAA8zNkWrMzZFqdXgLAAEE9QEAAAQUAAAAcHduZWQKUEsBAh4DCgAAAAAAoKgcXftes4UGAAAABgAAAA4AGAAAAAAAAQAAAKSBAAAAAC4uL291dHNpZGUudHh0VVQFAAPMzZFqdXgLAAEE9QEAAAQUAAAAUEsFBgAAAAABAAEAVAAAAE4AAAAAAA==',
          'base64'
        )
      );

      await expect(extractZip(archivePath, { dir: destDir })).rejects.toThrow();
      expect(() => readFileSync(join(root, 'outside.txt'), 'utf-8')).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
