import { appendFileSync, existsSync, mkdirSync, renameSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';

const MAX_LOG_BYTES = 2 * 1024 * 1024;
const TAIL_BYTES = 64 * 1024;

let logDirOverride: string | null = null;
let initialized = false;

export function setLogDirForTests(dir: string | null): void {
  logDirOverride = dir;
  initialized = false;
}

function getLogDir(): string {
  if (logDirOverride) {
    return logDirOverride;
  }
  return join(app.getPath('userData'), 'logs');
}

function getLogPath(): string {
  return join(getLogDir(), 'main.log');
}

function ensureLogDir(): void {
  const dir = getLogDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function rotateIfNeeded(): void {
  const path = getLogPath();
  if (!existsSync(path)) {
    return;
  }
  try {
    if (statSync(path).size < MAX_LOG_BYTES) {
      return;
    }
    const rotated = join(getLogDir(), 'main.prev.log');
    if (existsSync(rotated)) {
      try {
        renameSync(rotated, join(getLogDir(), 'main.prev2.log'));
      } catch {
        // ignore
      }
    }
    renameSync(path, rotated);
  } catch {
    // ignore rotation failures
  }
}

function formatLine(level: string, message: string, detail?: unknown): string {
  const ts = new Date().toISOString();
  let extra = '';
  if (detail !== undefined) {
    if (detail instanceof Error) {
      extra = ` ${detail.stack ?? detail.message}`;
    } else if (typeof detail === 'string') {
      extra = ` ${detail}`;
    } else {
      try {
        extra = ` ${JSON.stringify(detail)}`;
      } catch {
        extra = ` ${String(detail)}`;
      }
    }
  }
  return `${ts} [${level}] ${message}${extra}\n`;
}

function write(level: string, message: string, detail?: unknown): void {
  try {
    ensureLogDir();
    rotateIfNeeded();
    appendFileSync(getLogPath(), formatLine(level, message, detail), 'utf-8');
  } catch {
    // never throw from logging
  }
}

export function initLogging(): void {
  if (initialized) {
    return;
  }
  initialized = true;
  ensureLogDir();
  write('INFO', 'logging initialized');
}

export function logInfo(message: string, detail?: unknown): void {
  write('INFO', message, detail);
}

export function logError(message: string, detail?: unknown): void {
  write('ERROR', message, detail);
}

export function readLogTail(maxBytes = TAIL_BYTES): string {
  const path = getLogPath();
  if (!existsSync(path)) {
    return '';
  }
  try {
    const data = readFileSync(path);
    if (data.length <= maxBytes) {
      return data.toString('utf-8');
    }
    return data.subarray(data.length - maxBytes).toString('utf-8');
  } catch {
    return '';
  }
}

export function getLogFilePath(): string {
  return getLogPath();
}
