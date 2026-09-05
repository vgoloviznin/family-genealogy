import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProjectMeta, Person, PersonDetail, TreeData, AppSettings, MenuCommand, RecentProject } from '@shared/types';
import { normalizeRecentProjects } from '@shared/recents';

export function useProjectSession(showToast: (message: string, variant?: 'info' | 'error', duration?: number) => void) {
  const { t } = useTranslation();
  const [project, setProject] = useState<ProjectMeta | null>(null);
  const [recents, setRecents] = useState<RecentProject[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [personDetail, setPersonDetail] = useState<PersonDetail | null>(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'tree'>('list');
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [namePrompt, setNamePrompt] = useState<{ defaultValue: string; resolve: (value: string | null) => void } | null>(null);
  const dirtyRef = useRef(false);
  const flushSaveRef = useRef<() => Promise<boolean>>(async () => true);
  const viewRef = useRef(view);
  viewRef.current = view;

  const refreshCanUndo = useCallback(async () => {
    setCanUndo(await window.api.undo.canUndo());
  }, []);

  const confirmDiscardUnsaved = useCallback(async () => {
    return window.api.dialog.confirm({
      message: t('unsavedChangesTitle'),
      detail: t('unsavedChangesDetail'),
      confirmLabel: t('discardChanges'),
      destructive: true
    });
  }, [t]);

  const flushThen = useCallback(
    async (next: () => void | Promise<void>) => {
      const ok = await flushSaveRef.current();
      if (!ok && dirtyRef.current) {
        if (!(await confirmDiscardUnsaved())) {
          return;
        }
      }
      dirtyRef.current = false;
      await next();
    },
    [confirmDiscardUnsaved]
  );

  const prepareQuit = useCallback(async () => {
    const ok = await flushSaveRef.current();
    if (!ok && dirtyRef.current) {
      return confirmDiscardUnsaved();
    }
    return true;
  }, [confirmDiscardUnsaved]);

  const promptProjectName = useCallback(
    (defaultValue = t('defaultProjectName')) => {
      return new Promise<string | null>((resolve) => {
        setNamePrompt({ defaultValue, resolve });
      });
    },
    [t]
  );

  const resolveNamePrompt = useCallback(
    (value: string | null) => {
      namePrompt?.resolve(value);
      setNamePrompt(null);
    },
    [namePrompt]
  );

  const refreshPeople = useCallback(async () => {
    const list = search.trim() ? await window.api.people.search(search) : await window.api.people.list();
    setPeople(list);
  }, [search]);

  const refreshPerson = useCallback(async (id: string) => {
    const detail = await window.api.people.get(id);
    setPersonDetail(detail);
  }, []);

  const loadProject = useCallback(
    async (meta: ProjectMeta) => {
      setProject(meta);
      setSelectedId(null);
      setPersonDetail(null);
      setTreeData(null);
      dirtyRef.current = false;
      await refreshPeople();
      setRecents(normalizeRecentProjects(await window.api.project.getRecents()));
      await refreshCanUndo();
    },
    [refreshPeople, refreshCanUndo]
  );

  const selectPerson = useCallback(
    (id: string | null) => {
      if (id === selectedId) {
        return;
      }
      void flushThen(() => {
        setSelectedId(id);
        if (!id) {
          setPersonDetail(null);
        }
      });
    },
    [selectedId, flushThen]
  );

  const refreshTree = useCallback(
    async (personId?: string | null) => {
      try {
        const tree = personId ? await window.api.tree.get(personId) : await window.api.tree.get();
        setTreeData(tree);
      } catch (e) {
        setTreeData({ nodes: [], edges: [], families: [], focusPersonId: null });
        showToast((e as Error).message, 'error');
      }
    },
    [showToast]
  );

  useEffect(() => {
    void window.api.project.getCurrent().then((p) => {
      if (p) {
        void loadProject(p);
      }
    });
    void window.api.project.getRecents().then((raw) => setRecents(normalizeRecentProjects(raw)));
    void window.api.settings.get().then(setSettings);

    const unsubProgress = window.api.pack.onProgress((p) => {
      showToast(p.message);
    });
    const unsubOpened = window.api.project.onOpened((meta) => {
      void loadProject(meta);
    });
    const unsubPrepareQuit = window.api.app.onPrepareQuit(prepareQuit);

    return () => {
      unsubProgress();
      unsubOpened();
      unsubPrepareQuit();
    };
  }, [loadProject, showToast, prepareQuit]);

  useEffect(() => {
    if (project) {
      document.title = t('appTitleWithProject', { name: project.name });
    } else {
      document.title = t('appTitle');
    }
  }, [project, t]);

  useEffect(() => {
    if (project) {
      void refreshPeople();
    }
  }, [search, project, refreshPeople]);

  useEffect(() => {
    if (selectedId) {
      void refreshPerson(selectedId);
    }
  }, [selectedId, refreshPerson]);

  useEffect(() => {
    if (project) {
      void refreshCanUndo();
    }
  }, [project, personDetail, refreshCanUndo]);

  const familyTreeKey =
    personDetail?.id === selectedId ? personDetail.families.map((f) => `${f.id}:${f.partners.length}:${f.children.length}`).join('|') : '';

  useEffect(() => {
    if (view === 'tree') {
      void refreshTree(selectedId);
    }
  }, [view, selectedId, familyTreeKey, people.length, refreshTree]);

  const handleCreate = useCallback(
    async (name: string) => {
      try {
        const meta = await window.api.project.create(name);
        if (meta) {
          await loadProject(meta);
        }
      } catch (e) {
        showToast((e as Error).message, 'error');
      }
    },
    [loadProject, showToast]
  );

  const handleOpen = useCallback(async () => {
    try {
      const meta = await window.api.project.open();
      if (meta) {
        await loadProject(meta);
      }
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }, [loadProject, showToast]);

  const handleImport = useCallback(async () => {
    try {
      const meta = await window.api.pack.import();
      if (meta) {
        await loadProject(meta);
      }
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }, [loadProject, showToast]);

  const handleExport = useCallback(async () => {
    try {
      const path = await window.api.pack.export();
      if (path) {
        showToast(t('toast.exportDone', { path }), 'info', 4000);
      }
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }, [showToast, t]);

  const handleBackup = useCallback(async () => {
    try {
      const path = await window.api.pack.backup();
      if (path) {
        showToast(t('toast.backupDone', { path }), 'info', 4000);
      }
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }, [showToast, t]);

  const handleRestore = useCallback(async () => {
    try {
      const meta = await window.api.pack.restore();
      if (meta) {
        await loadProject(meta);
      }
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }, [loadProject, showToast]);

  const handleUndo = useCallback(async () => {
    try {
      const action = await window.api.undo.perform();
      if (!action) {
        return;
      }
      if (action.type === 'person-delete') {
        if (selectedId === action.id) {
          setSelectedId(null);
          setPersonDetail(null);
        }
      } else {
        const personId = action.type === 'person-undelete' ? action.id : selectedId;
        if (action.type === 'person-undelete') {
          setSelectedId(action.id);
        }
        if (personId) {
          await refreshPerson(personId);
        }
      }
      await refreshPeople();
      if (viewRef.current === 'tree') {
        await refreshTree(action.type === 'person-undelete' ? action.id : selectedId);
      }
      await refreshCanUndo();
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }, [refreshPeople, refreshPerson, refreshTree, refreshCanUndo, selectedId, showToast]);

  const handleAddPerson = useCallback(async () => {
    await flushThen(async () => {
      const p = await window.api.people.create({ firstName: '', lastName: '' });
      setView('list');
      dirtyRef.current = false;
      setSelectedId(p.id);
      setPersonDetail(p);
      await refreshPeople();
      await refreshCanUndo();
    });
  }, [flushThen, refreshPeople, refreshCanUndo]);

  const afterDataRefresh = useCallback(
    async (includeTree = false) => {
      await refreshPeople();
      if (selectedId) {
        await refreshPerson(selectedId);
      }
      if (includeTree && view === 'tree') {
        await refreshTree(selectedId);
      }
      await refreshCanUndo();
    },
    [refreshPeople, refreshPerson, refreshTree, refreshCanUndo, selectedId, view]
  );

  return {
    project,
    setProject,
    recents,
    people,
    selectedId,
    setSelectedId,
    personDetail,
    setPersonDetail,
    search,
    setSearch,
    view,
    setView,
    treeData,
    settingsOpen,
    setSettingsOpen,
    settings,
    setSettings,
    canUndo,
    namePrompt,
    resolveNamePrompt,
    promptProjectName,
    dirtyRef,
    flushSaveRef,
    flushThen,
    loadProject,
    selectPerson,
    refreshPeople,
    refreshPerson,
    refreshTree,
    refreshCanUndo,
    handleCreate,
    handleOpen,
    handleImport,
    handleExport,
    handleBackup,
    handleRestore,
    handleUndo,
    handleAddPerson,
    afterDataRefresh
  };
}

export function useMenuCommands(options: {
  flushThen: (next: () => void | Promise<void>) => Promise<void>;
  promptProjectName: (defaultValue?: string) => Promise<string | null>;
  handleCreate: (name: string) => Promise<void>;
  handleOpen: () => Promise<void>;
  handleImport: () => Promise<void>;
  handleSync: () => Promise<void>;
  handleSyncBatch: () => Promise<void>;
  setSyncHelpOpen: (open: boolean) => void;
  handleExport: () => Promise<void>;
  handleBackup: () => Promise<void>;
  handleRestore: () => Promise<void>;
  handleUndo: () => Promise<void>;
  showToast: (message: string, variant?: 'info' | 'error', duration?: number) => void;
  hasProject: boolean;
  onboardingBlocked: boolean;
}) {
  const {
    flushThen,
    promptProjectName,
    handleCreate,
    handleOpen,
    handleImport,
    handleSync,
    handleSyncBatch,
    setSyncHelpOpen,
    handleExport,
    handleBackup,
    handleRestore,
    handleUndo,
    showToast,
    hasProject,
    onboardingBlocked
  } = options;
  const { t } = useTranslation();

  useEffect(() => {
    return window.api.menu.onCommand((command: MenuCommand) => {
      const needsOnboardingGate = command === 'createProject' || command === 'openProject' || command === 'import' || command === 'restore';
      if (needsOnboardingGate && onboardingBlocked) {
        showToast(t('errors.onboardingRequired'), 'error');
        return;
      }
      const needsProject = command === 'export' || command === 'backup' || command === 'sync' || command === 'syncBatch' || command === 'undo';
      if (needsProject && !hasProject) {
        showToast(t('errors.projectNotOpen'), 'error');
        return;
      }
      if (command === 'createProject') {
        void flushThen(async () => {
          const name = await promptProjectName();
          if (name) {
            await handleCreate(name);
          }
        });
        return;
      }
      if (command === 'openProject') {
        void flushThen(() => void handleOpen());
        return;
      }
      if (command === 'import') {
        void flushThen(() => void handleImport());
        return;
      }
      if (command === 'sync') {
        void handleSync();
        return;
      }
      if (command === 'syncBatch') {
        void handleSyncBatch();
        return;
      }
      if (command === 'syncHelp') {
        setSyncHelpOpen(true);
        return;
      }
      if (command === 'copyDiagnostics') {
        void window.api.app
          .copyDiagnostics()
          .then(() => showToast(t('toast.diagnosticsCopied')))
          .catch((e) => showToast((e as Error).message, 'error'));
        return;
      }
      if (command === 'export') {
        void handleExport();
      }
      if (command === 'backup') {
        void handleBackup();
      }
      if (command === 'restore') {
        void flushThen(() => void handleRestore());
      }
      if (command === 'undo') {
        void handleUndo();
      }
    });
  }, [
    flushThen,
    promptProjectName,
    handleCreate,
    handleOpen,
    handleImport,
    handleSync,
    handleSyncBatch,
    setSyncHelpOpen,
    handleExport,
    handleBackup,
    handleRestore,
    handleUndo,
    showToast,
    t,
    hasProject,
    onboardingBlocked
  ]);
}
