import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Person, PersonDetail, UpdatePersonInput } from '@shared/types';
import { parseCoordinates } from '@shared/coordinates';
import { hasRequiredNamePart } from '@shared/person-name';
import { PersonAvatar } from './PersonAvatar';
import { personLabel, personLabelEn, formatLifeSpan } from '../lib/labels';
import { buildFormFromPerson, isPersonFormDirty, type PersonFormState } from './person-detail/helpers';
import { DangerBtn } from './person-detail/ui';
import { PersonInfoTab } from './person-detail/PersonInfoTab';
import { PersonFamilyTab } from './person-detail/PersonFamilyTab';
import { PersonEventsTab } from './person-detail/PersonEventsTab';
import { PersonAssociationsTab } from './person-detail/PersonAssociationsTab';
import { PersonMediaTab } from './person-detail/PersonMediaTab';
import { PersonSourcesTab } from './person-detail/PersonSourcesTab';

interface Props {
  person: PersonDetail;
  allPeople: Person[];
  onSave: (patch: UpdatePersonInput) => Promise<void>;
  onRefresh: () => Promise<void>;
  onSelectPerson: (id: string) => void;
  onDeleted: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onFlushSave: (flush: () => Promise<boolean>) => void;
  onSaveNotice: (message: string, variant?: 'info' | 'error') => void;
}

export function PersonDetailPanel({
  person,
  allPeople,
  onSave,
  onRefresh,
  onSelectPerson,
  onDeleted,
  onDirtyChange,
  onFlushSave,
  onSaveNotice
}: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'info' | 'family' | 'events' | 'associations' | 'media' | 'sources'>('info');
  const [form, setForm] = useState<PersonFormState>(() => buildFormFromPerson(person));
  const [saveError, setSaveError] = useState('');
  const [lastSavedForm, setLastSavedForm] = useState<PersonFormState>(() => buildFormFromPerson(person));
  const formRef = useRef(form);
  const lastSavedFormRef = useRef(lastSavedForm);
  const personRef = useRef(person);
  const savingRef = useRef<Promise<boolean> | null>(null);
  formRef.current = form;
  lastSavedFormRef.current = lastSavedForm;
  personRef.current = person;

  useEffect(() => {
    const next = buildFormFromPerson(person);
    setForm(next);
    setLastSavedForm(next);
    setSaveError('');
  }, [person.id]);

  const dirty = isPersonFormDirty(form, lastSavedForm);
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const persist = useCallback(
    async (mode: 'manual' | 'auto'): Promise<boolean> => {
      if (savingRef.current) {
        const previous = await savingRef.current;
        if (!isPersonFormDirty(formRef.current, lastSavedFormRef.current)) {
          return previous;
        }
      }
      const run = (async () => {
        const current = formRef.current;
        if (!isPersonFormDirty(current, lastSavedFormRef.current)) {
          return true;
        }
        if (!hasRequiredNamePart(current.firstName, current.lastName)) {
          setSaveError(t('personDetail.nameRequired'));
          return false;
        }
        if (!hasRequiredNamePart(current.firstNameEn, current.lastNameEn)) {
          setSaveError(t('personDetail.nameEnRequired'));
          return false;
        }
        const burialCoords = current.isLiving ? null : parseCoordinates(current.burialCoords);
        if (!current.isLiving && current.burialCoords.trim() && !burialCoords) {
          setSaveError(t('personDetail.coordinatesInvalid'));
          return false;
        }
        setSaveError('');
        const p = personRef.current;
        await onSave({
          id: p.id,
          firstName: current.firstName,
          lastName: current.lastName,
          middleName: current.middleName,
          maidenName: current.maidenName,
          firstNameEn: current.firstNameEn,
          lastNameEn: current.lastNameEn,
          middleNameEn: current.middleNameEn,
          maidenNameEn: current.maidenNameEn,
          sex: current.sex,
          isLiving: current.isLiving,
          notes: current.notes,
          birth: {
            placeName: current.birthPlace,
            date: current.birthDate
          },
          ...(current.isLiving
            ? { death: null, burial: null }
            : {
                death: {
                  placeName: current.deathPlace,
                  date: current.deathDate
                },
                burial: {
                  placeName: current.burialPlace,
                  latitude: burialCoords?.latitude ?? null,
                  longitude: burialCoords?.longitude ?? null
                }
              })
        });
        lastSavedFormRef.current = current;
        setLastSavedForm(current);
        onDirtyChange(false);
        onSaveNotice(mode === 'auto' ? t('personDetail.savedAuto') : t('personDetail.saved'));
        await onRefresh();
        return true;
      })();
      savingRef.current = run;
      try {
        return await run;
      } finally {
        savingRef.current = null;
      }
    },
    [onSave, onRefresh, onDirtyChange, onSaveNotice, t]
  );

  useEffect(() => {
    onFlushSave(() => persist('auto'));
  }, [onFlushSave, persist]);

  useEffect(() => {
    if (!dirty) {
      return;
    }
    const timer = window.setTimeout(() => {
      void persist('auto');
    }, 900);
    return () => window.clearTimeout(timer);
  }, [dirty, form, persist]);

  const otherPeople = useMemo(() => allPeople.filter((p) => p.id !== person.id), [allPeople, person.id]);

  const allEventsCount = useMemo(() => {
    const list = [...(person.birthEvent ? [person.birthEvent] : []), ...(person.deathEvent ? [person.deathEvent] : []), ...person.events];
    return list.length;
  }, [person]);

  const handleDeletePerson = async () => {
    const confirmed = await window.api.dialog.confirm({
      message: t('deletePersonConfirm', { name: personLabel(person) }),
      detail: t('deletePersonUndoHint'),
      destructive: true
    });
    if (!confirmed) {
      return;
    }
    await window.api.people.delete(person.id);
    onDeleted();
  };

  const tabs = [
    ['info', t('personDetail.tabInfo'), null],
    ['family', t('family'), person.families.length || null],
    ['events', t('events'), allEventsCount || null],
    ['associations', t('associations'), person.associations.length || null],
    ['media', t('media'), person.media.length || null],
    ['sources', t('sources'), person.citations.length || null]
  ] as const;

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-stone-200 overflow-hidden">
      <div className="p-4 border-b border-stone-100">
        <div className="flex items-start gap-3">
          <PersonAvatar personId={person.id} thumbUrl={person.thumbUrl} onUpdated={onRefresh} />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-serif">{personLabel(person)}</h2>
            {personLabelEn(person) ? <p className="text-sm text-stone-500 mt-0.5">{personLabelEn(person)}</p> : null}
            <p className="text-sm text-stone-500 mt-1">{formatLifeSpan(person)}</p>
          </div>
          {person.isLiving && (
            <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full shrink-0">{t('personDetail.livingBadge')}</span>
          )}
          {dirty && <span className="text-xs text-amber-700 shrink-0">{t('personDetail.unsaved')}</span>}
          <DangerBtn label={t('delete')} onClick={() => void handleDeletePerson()} />
        </div>
        <div className="flex gap-1 mt-3 flex-wrap">
          {tabs.map(([key, label, count]) => (
            <button
              key={key}
              className={`px-3 py-1 rounded-full text-sm inline-flex items-center gap-1.5 ${tab === key ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-700'}`}
              onClick={() => setTab(key)}
            >
              {label}
              {count !== null && count > 0 && (
                <span className={`text-xs px-1.5 rounded-full ${tab === key ? 'bg-stone-600' : 'bg-stone-200'}`}>{count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {saveError && <p className="text-sm text-red-700 bg-red-50 px-3 py-2 rounded">{saveError}</p>}

        {tab === 'info' && <PersonInfoTab form={form} onChange={setForm} onSave={() => void persist('manual')} />}

        {tab === 'family' && (
          <PersonFamilyTab
            person={person}
            otherPeople={otherPeople}
            onSelectPerson={onSelectPerson}
            onRefresh={onRefresh}
            onSaveNotice={onSaveNotice}
          />
        )}

        {tab === 'events' && <PersonEventsTab person={person} onRefresh={onRefresh} onError={(message) => setSaveError(message)} />}

        {tab === 'associations' && (
          <PersonAssociationsTab person={person} otherPeople={otherPeople} onSelectPerson={onSelectPerson} onRefresh={onRefresh} />
        )}

        {tab === 'media' && <PersonMediaTab person={person} onRefresh={onRefresh} />}

        {tab === 'sources' && <PersonSourcesTab person={person} onRefresh={onRefresh} onError={(message) => setSaveError(message)} />}
      </div>
    </div>
  );
}
