import type { MutableRefObject } from 'react';
import { PersonDetailPanel } from './PersonDetailPanel';
import type { Person, PersonDetail } from '@shared/types';

interface SessionLike {
  personDetail: PersonDetail | null;
  selectedId: string | null;
  people: Person[];
  dirtyRef: MutableRefObject<boolean>;
  flushSaveRef: MutableRefObject<() => Promise<boolean>>;
  setSelectedId: (id: string | null) => void;
  setPersonDetail: (detail: PersonDetail | null) => void;
  setView: (view: 'list' | 'tree') => void;
  selectPerson: (id: string | null) => void;
  flushThen: (next: () => void | Promise<void>) => Promise<void>;
  refreshPerson: (id: string) => Promise<void>;
  refreshPeople: () => Promise<void>;
  refreshTree: (personId?: string | null) => Promise<void>;
  refreshCanUndo: () => Promise<void>;
}

interface Props {
  session: SessionLike;
  showToast: (message: string, variant?: 'info' | 'error', duration?: number) => void;
  mode: 'list' | 'tree';
}

export function ProjectPersonDetailPanel({ session, showToast, mode }: Props) {
  if (!session.personDetail || !session.selectedId) {
    return null;
  }

  return (
    <PersonDetailPanel
      key={session.personDetail.id}
      person={session.personDetail}
      allPeople={session.people}
      onSave={async (patch) => {
        await window.api.people.update(patch);
        await session.refreshCanUndo();
      }}
      onRefresh={async () => {
        if (!session.selectedId) {
          return;
        }
        await session.refreshPerson(session.selectedId);
        await session.refreshPeople();
        if (mode === 'tree') {
          await session.refreshTree(session.selectedId);
        }
        await session.refreshCanUndo();
      }}
      onSelectPerson={(id) => {
        if (mode === 'list') {
          session.selectPerson(id);
          session.setView('list');
          return;
        }
        void session.flushThen(() => session.setSelectedId(id));
      }}
      onDeleted={() => {
        session.dirtyRef.current = false;
        session.setSelectedId(null);
        session.setPersonDetail(null);
        void session.refreshPeople();
        void session.refreshCanUndo();
        if (mode === 'tree') {
          void session.refreshTree(null);
        }
      }}
      onDirtyChange={(dirty) => {
        session.dirtyRef.current = dirty;
      }}
      onFlushSave={(fn) => {
        session.flushSaveRef.current = fn;
      }}
      onSaveNotice={showToast}
    />
  );
}
