import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProjectMeta, Person, PersonDetail, TreeData, AppSettings, MenuCommand, RecentProject } from '@shared/types'
import { normalizeRecentProjects } from '@shared/recents'
import { WelcomeScreen } from './components/WelcomeScreen'
import { PersonDetailPanel } from './components/PersonDetailPanel'
import { PersonAvatar } from './components/PersonAvatar'
import { TreeView } from './components/TreeView'
import { personLabel, formatLifeSpan } from './lib/labels'
import appIcon from './assets/icon.png'

export default function App() {
  const { t } = useTranslation()
  const [project, setProject] = useState<ProjectMeta | null>(null)
  const [recents, setRecents] = useState<RecentProject[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [personDetail, setPersonDetail] = useState<PersonDetail | null>(null)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'list' | 'tree'>('list')
  const [treeData, setTreeData] = useState<TreeData | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [packStatus, setPackStatus] = useState('')
  const [error, setError] = useState('')
  const [saveNotice, setSaveNotice] = useState('')
  const dirtyRef = useRef(false)
  const flushSaveRef = useRef<() => Promise<boolean>>(async () => true)
  const saveNoticeTimer = useRef<number | null>(null)

  const showSaveNotice = useCallback((message: string) => {
    setSaveNotice(message)
    if (saveNoticeTimer.current) window.clearTimeout(saveNoticeTimer.current)
    saveNoticeTimer.current = window.setTimeout(() => setSaveNotice(''), 1800)
  }, [])

  const flushThen = useCallback(async (next: () => void | Promise<void>) => {
    const ok = await flushSaveRef.current()
    if (!ok && dirtyRef.current) {
      if (!window.confirm('Есть несохранённые изменения. Уйти без сохранения?')) return
    }
    dirtyRef.current = false
    next()
  }, [])

  const refreshPeople = useCallback(async () => {
    const list = search.trim() ? await window.api.people.search(search) : await window.api.people.list()
    setPeople(list)
  }, [search])

  const refreshPerson = useCallback(async (id: string) => {
    const detail = await window.api.people.get(id)
    setPersonDetail(detail)
  }, [])

  const loadProject = useCallback(async (meta: ProjectMeta) => {
    setProject(meta)
    setSelectedId(null)
    setPersonDetail(null)
    dirtyRef.current = false
    await refreshPeople()
    setRecents(normalizeRecentProjects(await window.api.project.getRecents()))
  }, [refreshPeople])

  const selectPerson = useCallback((id: string | null) => {
    if (id === selectedId) return
    void flushThen(() => {
      setSelectedId(id)
      if (!id) setPersonDetail(null)
    })
  }, [selectedId, flushThen])

  useEffect(() => {
    void window.api.project.getCurrent().then((p) => {
      if (p) void loadProject(p)
    })
    void window.api.project.getRecents().then((raw) => setRecents(normalizeRecentProjects(raw)))
    void window.api.settings.get().then(setSettings)

    const unsubProgress = window.api.pack.onProgress((p) => {
      setPackStatus(p.message)
    })
    const unsubOpened = window.api.project.onOpened((meta) => {
      void loadProject(meta)
    })

    return () => {
      unsubProgress()
      unsubOpened()
    }
  }, [loadProject])

  useEffect(() => {
    if (project) {
      document.title = t('appTitleWithProject', { name: project.name })
    } else {
      document.title = t('appTitle')
    }
  }, [project, t])

  useEffect(() => {
    if (project) void refreshPeople()
  }, [search, project, refreshPeople])

  useEffect(() => {
    if (selectedId) void refreshPerson(selectedId)
  }, [selectedId, refreshPerson])

  const refreshTree = useCallback(async (personId: string) => {
    const tree = await window.api.tree.get(personId)
    setTreeData(tree)
  }, [])

  const familyTreeKey =
    personDetail?.id === selectedId
      ? personDetail.families.map((f) => `${f.id}:${f.partners.length}:${f.children.length}`).join('|')
      : ''

  useEffect(() => {
    if (view === 'tree' && selectedId) {
      void refreshTree(selectedId)
    }
  }, [view, selectedId, familyTreeKey, people.length, refreshTree])

  const handleCreate = async (name: string) => {
    try {
      setError('')
      const meta = await window.api.project.create(name)
      await loadProject(meta)
    } catch (e) {
      if ((e as Error).message !== 'Cancelled') setError((e as Error).message)
    }
  }

  const handleOpen = async () => {
    try {
      setError('')
      const meta = await window.api.project.open()
      if (meta) await loadProject(meta)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const handleImport = async () => {
    try {
      const meta = await window.api.pack.import()
      if (meta) await loadProject(meta)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const handleExport = async () => {
    const path = await window.api.pack.export()
    if (path) setPackStatus(`Экспорт: ${path}`)
  }

  const handleBackup = async () => {
    const path = await window.api.pack.backup()
    if (path) setPackStatus(`Бэкап: ${path}`)
  }

  const handleRestore = async () => {
    const meta = await window.api.pack.restore()
    if (meta) await loadProject(meta)
  }

  const handleUndo = async () => {
    const action = await window.api.undo.perform()
    if (!action) return
    if (action.type === 'person-undelete') {
      setSelectedId(action.id)
    }
    if (selectedId) await refreshPerson(action.type === 'person-undelete' ? action.id : selectedId)
    await refreshPeople()
  }

  const handleAddPerson = async () => {
    await flushThen(async () => {
      const p = await window.api.people.create({ firstName: '', lastName: '' })
      setView('list')
      dirtyRef.current = false
      setSelectedId(p.id)
      setPersonDetail(p)
      await refreshPeople()
    })
  }

  useEffect(() => {
    return window.api.menu.onCommand((command: MenuCommand) => {
      if (command === 'createProject') {
        void flushThen(() => {
          const name = window.prompt('Название проекта', 'Моё семейное древо')
          if (name) void handleCreate(name)
        })
        return
      }
      if (command === 'openProject') {
        void flushThen(() => void handleOpen())
        return
      }
      if (command === 'import') {
        void flushThen(() => void handleImport())
        return
      }
      if (command === 'export') void handleExport()
      if (command === 'backup') void handleBackup()
      if (command === 'restore') {
        void flushThen(() => void handleRestore())
      }
      if (command === 'undo') void handleUndo()
    })
  }, [project, selectedId, flushThen])

  if (!project) {
    return (
      <>
        {error && <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-100 text-red-800 px-4 py-2 rounded">{error}</div>}
        <WelcomeScreen
          recents={recents}
          onCreate={(n) => void handleCreate(n)}
          onOpen={() => void handleOpen()}
          onImport={() => void handleImport()}
          onOpenRecent={async (path) => {
            if (!path) return
            try {
              setError('')
              const meta = await window.api.project.openPath(path)
              await loadProject(meta)
            } catch (e) {
              setError((e as Error).message)
            }
          }}
        />
      </>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-[#f4f1eb]">
      <header className="flex items-center gap-4 px-4 py-3 bg-white border-b border-stone-200 shadow-sm">
        <img src={appIcon} alt="" width={28} height={28} className="w-7 h-7" />
        <h1 className="font-serif text-lg text-stone-800">{t('appTitleWithProject', { name: project.name })}</h1>
        {project.cloudWarning && (
          <span className="text-xs bg-amber-100 text-amber-900 px-2 py-1 rounded">{t('cloudWarning')}</span>
        )}
        <div className="flex-1" />
        <button className="text-sm px-3 py-1 rounded border" onClick={() => void flushThen(() => setView('list'))}>
          {t('people')}
        </button>
        <button
          className="text-sm px-3 py-1 rounded border"
          onClick={() => void flushThen(() => setView('tree'))}
          disabled={!selectedId}
        >
          {t('tree')}
        </button>
        <button className="text-sm px-3 py-1 rounded border" onClick={() => void handleExport()}>
          {t('export')}
        </button>
        <button className="text-sm px-3 py-1 rounded border" onClick={() => void handleBackup()}>
          {t('backup')}
        </button>
        <button className="text-sm px-3 py-1 rounded border" onClick={() => void handleUndo()}>
          {t('undo')}
        </button>
        <button className="text-sm px-3 py-1 rounded border" onClick={() => setSettingsOpen(true)}>
          {t('settings')}
        </button>
      </header>

      <SaveToast message={saveNotice} />
      {packStatus && <div className="text-xs text-center py-1 bg-stone-100 text-stone-600">{packStatus}</div>}
      {error && <div className="text-xs text-center py-1 bg-red-50 text-red-700">{error}</div>}

      <div className="flex-1 flex gap-3 p-3 min-h-0">
        {view === 'list' ? (
          <>
            <aside className="w-72 flex flex-col bg-white rounded-lg border border-stone-200 overflow-hidden">
              <div className="p-3 border-b space-y-2">
                <input
                  className="w-full border rounded px-2 py-1 text-sm"
                  placeholder={t('search')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button className="w-full bg-stone-800 text-white text-sm py-2 rounded-lg" onClick={() => void handleAddPerson()}>
                  {t('addPerson')}
                </button>
              </div>
              <ul className="flex-1 overflow-auto">
                {people.map((p) => (
                  <li
                    key={p.id}
                    className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-stone-50 ${selectedId === p.id ? 'bg-stone-100' : ''}`}
                  >
                    <PersonAvatar
                      personId={p.id}
                      thumbUrl={p.thumbUrl}
                      size="sm"
                      onUpdated={async () => {
                        await refreshPeople()
                        if (selectedId === p.id) await refreshPerson(p.id)
                      }}
                    />
                    <button
                      type="button"
                      className={`flex-1 min-w-0 text-left ${selectedId === p.id ? 'font-medium' : ''}`}
                      onClick={() => selectPerson(p.id)}
                    >
                      <div className="truncate">{personLabel(p)}</div>
                      <div className="text-xs text-stone-500 mt-0.5">{formatLifeSpan(p)}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>
            <main className="flex-1 min-w-0">
              {personDetail && selectedId ? (
                <PersonDetailPanel
                  key={personDetail.id}
                  person={personDetail}
                  allPeople={people}
                  onSave={async (patch) => {
                    await window.api.people.update(patch)
                  }}
                  onRefresh={async () => {
                    await refreshPerson(selectedId)
                    await refreshPeople()
                  }}
                  onSelectPerson={(id) => {
                    selectPerson(id)
                    setView('list')
                  }}
                  onDeleted={() => {
                    dirtyRef.current = false
                    setSelectedId(null)
                    setPersonDetail(null)
                    void refreshPeople()
                  }}
                  onDirtyChange={(d) => {
                    dirtyRef.current = d
                  }}
                  onFlushSave={(fn) => {
                    flushSaveRef.current = fn
                  }}
                  onSaveNotice={showSaveNotice}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-stone-500 bg-white rounded-lg border">
                  Выберите человека из списка
                </div>
              )}
            </main>
          </>
        ) : (
          <div className="flex-1 min-h-0">
            {treeData ? (
              <TreeView
                key={treeData.focusPersonId}
                data={treeData}
                onSelectPerson={(id) => {
                  void flushThen(() => {
                    setSelectedId(id)
                    setView('list')
                  })
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-stone-500">Загрузка древа…</div>
            )}
          </div>
        )}
      </div>

      {settingsOpen && settings && (
        <SettingsModal
          settings={settings}
          projectName={project.name}
          onClose={() => setSettingsOpen(false)}
          onSave={async (partial, name) => {
            const s = await window.api.settings.set(partial)
            setSettings(s)
            if (name.trim() && name.trim() !== project.name) {
              const meta = await window.api.project.setName(name)
              setProject(meta)
            }
            setSettingsOpen(false)
          }}
        />
      )}
    </div>
  )
}

function SettingsModal({
  settings,
  projectName,
  onClose,
  onSave
}: {
  settings: AppSettings
  projectName: string
  onClose: () => void
  onSave: (partial: Partial<AppSettings>, projectName: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(projectName)
  const [backupFolder, setBackupFolder] = useState(settings.backupFolder ?? '')
  const [backupOnQuit, setBackupOnQuit] = useState(settings.backupOnQuit)
  const [backupKeepCount, setBackupKeepCount] = useState(settings.backupKeepCount)
  const [editorLabel, setEditorLabel] = useState(settings.editorLabel)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl">
        <h2 className="text-lg font-medium">{t('settings')}</h2>
        <label className="block text-sm">
          {t('projectName')}
          <input className="w-full border rounded px-2 py-1 mt-1" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block text-sm">
          {t('editorLabel')}
          <input className="w-full border rounded px-2 py-1 mt-1" value={editorLabel} onChange={(e) => setEditorLabel(e.target.value)} />
        </label>
        <label className="block text-sm">
          {t('backupFolder')}
          <div className="flex gap-2 mt-1">
            <input className="flex-1 border rounded px-2 py-1" value={backupFolder} onChange={(e) => setBackupFolder(e.target.value)} placeholder="По умолчанию: Backups в папке проекта" />
            <button
              className="border rounded px-2 text-sm"
              onClick={() => {
                void window.api.settings.pickFolder().then((p) => {
                  if (p) setBackupFolder(p)
                })
              }}
            >
              …
            </button>
          </div>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={backupOnQuit} onChange={(e) => setBackupOnQuit(e.target.checked)} />
          {t('backupOnQuit')}
        </label>
        <label className="block text-sm">
          Хранить копий
          <input type="number" min={1} max={50} className="w-full border rounded px-2 py-1 mt-1" value={backupKeepCount} onChange={(e) => setBackupKeepCount(Number(e.target.value))} />
        </label>
        <div className="flex justify-end gap-2">
          <button className="px-4 py-2 rounded border" onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            className="px-4 py-2 rounded bg-stone-800 text-white disabled:opacity-50"
            disabled={!name.trim()}
            onClick={() =>
              void onSave({ backupFolder: backupFolder || undefined, backupOnQuit, backupKeepCount, editorLabel }, name)
            }
          >
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  )
}

function SaveToast({ message }: { message: string }) {
  const [text, setText] = useState(message)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (message) {
      setText(message)
      setOpen(false)
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setOpen(true))
      })
      return () => window.cancelAnimationFrame(frame)
    }
    setOpen(false)
    const hide = window.setTimeout(() => setText(''), 320)
    return () => window.clearTimeout(hide)
  }, [message])

  if (!text) return null

  return (
    <div className="fixed bottom-4 left-4 z-50 pointer-events-none">
      <div
        className={`text-xs text-stone-600 bg-white/90 border border-stone-200 shadow-sm rounded-md px-3 py-1.5 transition-opacity duration-300 ease-out ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {text}
      </div>
    </div>
  )
}
