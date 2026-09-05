import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { initLogging, logInfo, logError, readLogTail, setLogDirForTests, getLogFilePath } from '@main/utils/log';

describe('log utils', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'fgtree-log-'));
    setLogDirForTests(dir);
    initLogging();
  });

  afterEach(() => {
    setLogDirForTests(null);
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes info and error lines to main.log', () => {
    logInfo('hello', { a: 1 });
    logError('boom', new Error('fail'));
    const path = getLogFilePath();
    expect(existsSync(path)).toBe(true);
    const text = readFileSync(path, 'utf-8');
    expect(text).toContain('[INFO] hello');
    expect(text).toContain('[ERROR] boom');
    expect(text).toContain('fail');
  });

  it('returns log tail', () => {
    logInfo('tail-check');
    const tail = readLogTail();
    expect(tail).toContain('tail-check');
  });

  it('rotates when file exceeds max size', () => {
    const path = getLogFilePath();
    writeFileSync(path, 'x'.repeat(2 * 1024 * 1024 + 10));
    logInfo('after-rotate');
    expect(existsSync(join(dir, 'main.prev.log'))).toBe(true);
    expect(readFileSync(path, 'utf-8')).toContain('after-rotate');
  });
});
