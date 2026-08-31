import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ProjectPersonDetailPanel } from './components/ProjectPersonDetailPanel';
import { PersonAvatar } from './components/PersonAvatar';
import { TreeView } from './components/TreeView';
import { MergeConflictDialog } from './components/MergeConflictDialog';
import { MergeReportDialog } from './components/MergeReportDialog';
import { SyncHelpDialog } from './components/SyncHelpDialog';
import { SettingsModal } from './components/SettingsModal';
import { PromptDialog } from './components/PromptDialog';
import { Toast } from './components/Toast';
import { personLabel, formatLifeSpan } from './lib/labels';
import { useToast } from './hooks/useToast';
import { useProjectSession, useMenuCommands } from './hooks/useProjectSession';
import { useSyncFlow } from './hooks/useSyncFlow';
import appIcon from './assets/icon.png';

export default function App() {
  const { t } = useTranslation();
  const { toast, showToast } = useToast();
  const session = useProjectSession(showToast);

  const refreshAfterSync = useCallback(async () => {
    await session.afterDataRefresh(session.view === 'tree');
  }, [session.afterDataRefresh, session.view]);

  const sync = useSyncFlow({
    flushThen: session.flushThen,
    refreshAfterSync,
    showToast
  });

  useMenuCommands({
    flushThen: session.flushThen,
    promptProjectName: session.promptProjectName,
    handleCreate: session.handleCreate,
    handleOpen: session.handleOpen,
    handleImport: session.handleImport,
    handleSync: sync.handleSync,
    handleSyncBatch: sync.handleSyncBatch,
    setSyncHelpOpen: sync.setSyncHelpOpen,
    handleExport: session.handleExport,
    handleBackup: session.handleBackup,
    handleRestore: session.handleRestore,
    handleUndo: session.handleUndo
  });

  if (!session.project) {
    return (
      <>
        <WelcomeScreen
          recents={session.recents}
          onCreate={(n) => void session.handleCreate(n)}
          onOpen={() => void session.handleOpen()}
          onImport={() => void session.handleImport()}
          onOpenRecent={async (path) => {
            if (!path) {
              return;
            }
            try {
              const meta = await window.api.project.openPath(path);
              await session.loadProject(meta);
            } catch (e) {
              showToast((e as Error).message, 'error');
            }
          }}
        />
        <Toast toast={toast} />
      </>
    );
  }

  const project = session.project;

  return (
    <div className="h-screen flex flex-col bg-[#f4f1eb]">
      <header className="flex items-center gap-4 px-4 py-3 bg-white border-b border-stone-200 shadow-sm">
        <img src={appIcon} alt="" width={28} height={28} className="w-7 h-7" />
        <h1 className="font-serif text-lg text-stone-800">{t('appTitleWithProject', { name: project.name })}</h1>
        {project.cloudWarning && <span className="text-xs bg-amber-100 text-amber-900 px-2 py-1 rounded">{t('cloudWarning')}</span>}
        <div className="flex-1" />
        <button className="text-sm px-3 py-1 rounded border" onClick={() => void session.flushThen(() => session.setView('list'))}>
          {t('people')}
        </button>
        <button className="text-sm px-3 py-1 rounded border" onClick={() => void session.flushThen(() => session.setView('tree'))}>
          {t('tree')}
        </button>
        <button className="text-sm px-3 py-1 rounded border" onClick={() => void session.handleExport()}>
          {t('export')}
        </button>
        <button className="text-sm px-3 py-1 rounded border" onClick={() => void sync.handleSync()}>
          {t('syncFromArchive')}
        </button>
        <button className="text-sm px-3 py-1 rounded border" onClick={() => void sync.handleSyncBatch()}>
          {t('syncBatchFromArchives')}
        </button>
        <button className="text-sm px-3 py-1 rounded border" onClick={() => sync.setSyncHelpOpen(true)}>
          {t('syncHelpLink')}
        </button>
        <button className="text-sm px-3 py-1 rounded border" onClick={() => void session.handleBackup()}>
          {t('backup')}
        </button>
        <button
          className="text-sm px-3 py-1 rounded border disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!session.canUndo}
          onClick={() => void session.handleUndo()}
        >
          {t('undo')}
        </button>
        <button className="text-sm px-3 py-1 rounded border" onClick={() => session.setSettingsOpen(true)}>
          {t('settings')}
        </button>
      </header>

      <div className="flex-1 flex gap-3 p-3 min-h-0">
        {session.view === 'list' ? (
          <>
            <aside className="w-72 flex flex-col bg-white rounded-lg border border-stone-200 overflow-hidden">
              <div className="p-3 border-b space-y-2">
                <input
                  className="w-full border rounded px-2 py-1 text-sm"
                  placeholder={t('search')}
                  value={session.search}
                  onChange={(e) => session.setSearch(e.target.value)}
                />
                <button className="w-full bg-stone-800 text-white text-sm py-2 rounded-lg" onClick={() => void session.handleAddPerson()}>
                  {t('addPerson')}
                </button>
              </div>
              <ul className="flex-1 overflow-auto">
                {session.people.map((p) => (
                  <li
                    key={p.id}
                    className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-stone-50 ${session.selectedId === p.id ? 'bg-stone-100' : ''}`}
                  >
                    <PersonAvatar
                      personId={p.id}
                      thumbUrl={p.thumbUrl}
                      size="sm"
                      onUpdated={async () => {
                        await session.refreshPeople();
                        if (session.selectedId === p.id) {
                          await session.refreshPerson(p.id);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className={`flex-1 min-w-0 text-left ${session.selectedId === p.id ? 'font-medium' : ''}`}
                      onClick={() => session.selectPerson(p.id)}
                    >
                      <div className="truncate">{personLabel(p)}</div>
                      <div className="text-xs text-stone-500 mt-0.5">{formatLifeSpan(p)}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>
            <main className="flex-1 min-w-0">
              {session.personDetail && session.selectedId ? (
                <ProjectPersonDetailPanel session={session} showToast={showToast} mode="list" />
              ) : (
                <div className="h-full flex items-center justify-center text-stone-500 bg-white rounded-lg border">{t('selectPersonHint')}</div>
              )}
            </main>
          </>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              {session.treeData ? (
                session.treeData.nodes.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-stone-500 bg-[#f4f1eb] rounded-lg border border-stone-200">
                    {t('treeEmptyHint')}
                  </div>
                ) : (
                  <TreeView
                    data={session.treeData}
                    selectedId={session.selectedId}
                    onSelectPerson={(id) => {
                      void session.flushThen(() => {
                        session.setSelectedId(id);
                        if (!id) {
                          session.setPersonDetail(null);
                        }
                      });
                    }}
                  />
                )
              ) : (
                <div className="h-full flex items-center justify-center text-stone-500 bg-[#f4f1eb] rounded-lg border border-stone-200">
                  {t('treeLoadingHint')}
                </div>
              )}
            </div>
            {session.personDetail && session.selectedId ? (
              <aside className="w-[420px] shrink-0 min-w-0">
                <ProjectPersonDetailPanel session={session} showToast={showToast} mode="tree" />
              </aside>
            ) : null}
          </>
        )}
      </div>

      {session.settingsOpen && session.settings && (
        <SettingsModal
          settings={session.settings}
          projectName={project.name}
          onClose={() => session.setSettingsOpen(false)}
          onSave={async (partial, name) => {
            const s = await window.api.settings.set(partial);
            session.setSettings(s);
            if (name.trim() && name.trim() !== project.name) {
              const meta = await window.api.project.setName(name);
              session.setProject(meta);
            }
            session.setSettingsOpen(false);
          }}
        />
      )}

      {session.namePrompt && (
        <PromptDialog
          title={t('createProject')}
          label={t('projectName')}
          defaultValue={session.namePrompt.defaultValue}
          onCancel={() => session.resolveNamePrompt(null)}
          onSubmit={(value) => session.resolveNamePrompt(value)}
        />
      )}

      {sync.syncPreview && (
        <MergeConflictDialog
          preview={
            sync.syncPreview.kind === 'single'
              ? {
                  conflicts: sync.syncPreview.preview.conflicts,
                  archivePath: sync.syncPreview.preview.archivePath
                }
              : {
                  conflicts: sync.syncPreview.preview.allConflicts,
                  previewNote: sync.syncPreview.preview.previewNote
                }
          }
          onCancel={() => sync.setSyncPreview(null)}
          onApply={(resolutions) => void sync.handleApplySyncResolutions(resolutions)}
        />
      )}

      {sync.mergeReport && <MergeReportDialog result={sync.mergeReport} onClose={() => sync.setMergeReport(null)} />}

      {sync.syncHelpOpen && <SyncHelpDialog editorLabel={session.settings?.editorLabel} onClose={() => sync.setSyncHelpOpen(false)} />}

      <Toast toast={toast} />
    </div>
  );
}
