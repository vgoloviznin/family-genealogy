import { app, clipboard } from 'electron';
import { SCHEMA_VERSION } from '../db/schema';
import { getAppLocale, localizedError } from '../i18n';
import { getSettings } from './settings';
import { getCurrentProject } from './project';
import { getLogFilePath, logError, readLogTail } from '../utils/log';

export function buildDiagnosticsText(): string {
  const settings = getSettings();
  const project = getCurrentProject();
  const lines = [
    'Family Genealogy diagnostics',
    `appVersion: ${app.getVersion()}`,
    `platform: ${process.platform} ${process.arch}`,
    `electron: ${process.versions.electron}`,
    `node: ${process.versions.node}`,
    `locale: ${getAppLocale()}`,
    `schemaVersion: ${SCHEMA_VERSION}`,
    `deviceId: ${settings.deviceId}`,
    `editorLabel: ${settings.editorLabel || '(empty)'}`,
    `onboardingComplete: ${Boolean(settings.onboardingComplete)}`,
    `backupFolder: ${settings.backupFolder ?? '(default)'}`,
    `projectPath: ${project?.path ?? '(none)'}`,
    `projectId: ${project?.projectId ?? '(none)'}`,
    `logFile: ${getLogFilePath()}`,
    '',
    '--- log tail ---',
    readLogTail()
  ];
  return lines.join('\n');
}

export function copyDiagnosticsToClipboard(): { ok: true } {
  try {
    clipboard.writeText(buildDiagnosticsText());
    return { ok: true };
  } catch (err) {
    logError('copyDiagnostics', err);
    throw new Error(localizedError('errors.copyDiagnosticsFailed'));
  }
}
