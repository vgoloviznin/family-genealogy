import { createWriteStream, mkdirSync } from 'fs';
import { dirname, resolve, sep } from 'path';
import { pipeline } from 'stream/promises';
import yauzl from 'yauzl';
import { zipError } from './zip-errors';

function resolveEntryPath(destDir: string, entryName: string): string {
  const normalized = entryName.replace(/\\/g, '/');
  const destPath = resolve(destDir, normalized);
  const root = resolve(destDir);
  if (destPath !== root && !destPath.startsWith(root + sep)) {
    throw zipError('errors.unsafeZipEntry', { path: entryName });
  }
  return destPath;
}

function isUnixSymlink(entry: yauzl.Entry): boolean {
  return (((entry.externalFileAttributes ?? 0) >> 16) & 0o170000) === 0o120000;
}

export async function extractZip(archivePath: string, options: { dir: string }): Promise<void> {
  const destDir = resolve(options.dir);
  mkdirSync(destDir, { recursive: true });

  await new Promise<void>((resolvePromise, reject) => {
    yauzl.open(archivePath, { lazyEntries: true, autoClose: true }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(zipError('errors.zipOpenFailed'));
        return;
      }

      const fail = (error: unknown): void => {
        zipfile.close();
        reject(error);
      };

      zipfile.on('entry', (entry) => {
        if (isUnixSymlink(entry)) {
          fail(zipError('errors.unsafeZipSymlink', { path: entry.fileName }));
          return;
        }

        if (entry.fileName.endsWith('/')) {
          try {
            mkdirSync(resolveEntryPath(destDir, entry.fileName), { recursive: true });
            zipfile.readEntry();
          } catch (error) {
            fail(error);
          }
          return;
        }

        zipfile.openReadStream(entry, (readErr, readStream) => {
          if (readErr || !readStream) {
            fail(zipError('errors.zipReadFailed', { path: entry.fileName }));
            return;
          }

          void (async () => {
            try {
              const filePath = resolveEntryPath(destDir, entry.fileName);
              mkdirSync(dirname(filePath), { recursive: true });
              await pipeline(readStream, createWriteStream(filePath));
              zipfile.readEntry();
            } catch (error) {
              fail(error);
            }
          })();
        });
      });

      zipfile.on('end', () => resolvePromise());
      zipfile.on('error', fail);
      zipfile.readEntry();
    });
  });
}
