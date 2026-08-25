import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  PersonDetail,
  Person,
  UpsertEventInput,
  CreateAssociationInput,
  EventTypeCode,
  LifeEvent,
  UpdatePersonInput,
  Source,
  SourceType,
  PedigreeType,
  UnionType,
  Sex,
  UndoAction
} from '@shared/types';
import { DateFields } from './DateFields';
import { PlaceField } from './PlaceField';
import { CoordinatesField } from './CoordinatesField';
import { PersonAvatar } from './PersonAvatar';
import {
  personLabel,
  formatDate,
  formatLifeSpan,
  EVENT_TYPE_LABELS,
  ASSOCIATION_LABELS,
  PEDIGREE_LABELS,
  SEX_LABELS,
  UNION_TYPE_LABELS,
  SOURCE_TYPE_LABELS,
  DEATH_RELATED_EVENTS,
  ADDABLE_EVENT_TYPES,
  emptyDate,
  spouseLabel,
  siblingLabel
} from '../lib/labels';
import { formatCoordinates, parseCoordinates } from '@shared/coordinates';

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

function buildFormFromPerson(person: PersonDetail) {
  return {
    firstName: person.firstName,
    lastName: person.lastName,
    middleName: person.middleName ?? '',
    maidenName: person.maidenName ?? '',
    sex: person.sex,
    isLiving: person.isLiving,
    notes: person.notes ?? '',
    birthDate: person.birthEvent?.date ?? emptyDate(),
    birthPlace: person.birthEvent?.placeName ?? '',
    deathDate: person.deathEvent?.date ?? emptyDate(),
    deathPlace: person.deathEvent?.placeName ?? '',
    burialPlace: person.burialEvent?.placeName ?? '',
    burialCoords: formatCoordinates(person.burialEvent?.latitude, person.burialEvent?.longitude)
  };
}

function snapshotPerson(p: PersonDetail): UpdatePersonInput {
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    middleName: p.middleName ?? '',
    maidenName: p.maidenName ?? '',
    sex: p.sex,
    isLiving: p.isLiving,
    notes: p.notes ?? '',
    birth: {
      placeName: p.birthEvent?.placeName ?? '',
      date: p.birthEvent?.date ?? emptyDate(),
      description: p.birthEvent?.description ?? ''
    },
    death: p.isLiving
      ? null
      : {
          placeName: p.deathEvent?.placeName ?? '',
          date: p.deathEvent?.date ?? emptyDate(),
          description: p.deathEvent?.description ?? ''
        },
    burial: p.isLiving
      ? null
      : {
          placeName: p.burialEvent?.placeName ?? '',
          latitude: p.burialEvent?.latitude ?? null,
          longitude: p.burialEvent?.longitude ?? null,
          date: p.burialEvent?.date ?? emptyDate(),
          description: p.burialEvent?.description ?? ''
        }
  };
}

function snapshotEvent(ev: LifeEvent): UpsertEventInput & { id: string } {
  return {
    id: ev.id,
    type: ev.type,
    customLabel: ev.customLabel ?? undefined,
    personId: ev.personId ?? undefined,
    familyId: ev.familyId ?? undefined,
    placeName: ev.placeName ?? '',
    description: ev.description ?? '',
    latitude: ev.latitude ?? null,
    longitude: ev.longitude ?? null,
    date: ev.date
  };
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
  const [form, setForm] = useState(() => buildFormFromPerson(person));
  const [saveError, setSaveError] = useState('');
  const [editingEventId, setEditingEventId] = useState<string | 'new' | null>(null);
  const [eventDraft, setEventDraft] = useState<UpsertEventInput>({
    type: 'residence',
    personId: person.id,
    placeName: '',
    description: '',
    date: emptyDate()
  });
  const [showAssociationForm, setShowAssociationForm] = useState(false);
  const [assocPersonId, setAssocPersonId] = useState('');
  const [assocRole, setAssocRole] = useState<CreateAssociationInput['role']>('godparent');
  const [linkKind, setLinkKind] = useState<'partner' | 'child' | 'parent' | 'sibling' | null>(null);
  const [linkPersonId, setLinkPersonId] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [citeSourceId, setCiteSourceId] = useState('');
  const [citeNewTitle, setCiteNewTitle] = useState('');
  const [citeType, setCiteType] = useState<SourceType>('document');
  const [citePage, setCitePage] = useState('');
  const [citeExcerpt, setCiteExcerpt] = useState('');
  const [citeEventId, setCiteEventId] = useState('');
  const [showCiteForm, setShowCiteForm] = useState(false);
  const [dissolvingFamilyId, setDissolvingFamilyId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState(() => JSON.stringify(buildFormFromPerson(person)));
  const formRef = useRef(form);
  const lastSavedRef = useRef(lastSaved);
  const personRef = useRef(person);
  const savingRef = useRef<Promise<boolean> | null>(null);
  formRef.current = form;
  lastSavedRef.current = lastSaved;
  personRef.current = person;

  useEffect(() => {
    const next = buildFormFromPerson(person);
    setForm(next);
    setLastSaved(JSON.stringify(next));
    setSaveError('');
    setEditingEventId(null);
    setShowAssociationForm(false);
    setLinkKind(null);
    setShowCiteForm(false);
    setDissolvingFamilyId(null);
  }, [person.id]);

  useEffect(() => {
    void window.api.sources.list().then(setSources);
  }, [person.id, person.citations.length]);

  const dirty = JSON.stringify(form) !== lastSaved;

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const persist = useCallback(
    async (mode: 'manual' | 'auto'): Promise<boolean> => {
      if (savingRef.current) {
        const previous = await savingRef.current;
        if (JSON.stringify(formRef.current) === lastSavedRef.current) {
          return previous;
        }
      }
      const run = (async () => {
        const current = formRef.current;
        const snapshot = JSON.stringify(current);
        if (snapshot === lastSavedRef.current) {
          return true;
        }
        if (!current.firstName.trim() && !current.lastName.trim()) {
          if (mode === 'manual') {
            setSaveError('Укажите имя или фамилию');
          }
          return false;
        }
        const burialCoords = current.isLiving ? null : parseCoordinates(current.burialCoords);
        if (!current.isLiving && current.burialCoords.trim() && !burialCoords) {
          setSaveError('Укажите координаты в формате: 55.7558, 37.6173');
          return false;
        }
        setSaveError('');
        const p = personRef.current;
        if (mode === 'manual') {
          await window.api.undo.push({ type: 'person-update', before: snapshotPerson(p) });
        }
        await onSave({
          id: p.id,
          firstName: current.firstName,
          lastName: current.lastName,
          middleName: current.middleName,
          maidenName: current.maidenName,
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
        lastSavedRef.current = snapshot;
        setLastSaved(snapshot);
        onDirtyChange(false);
        onSaveNotice(mode === 'auto' ? 'Сохранено автоматически' : 'Сохранено');
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
    [onSave, onRefresh, onDirtyChange, onSaveNotice]
  );

  useEffect(() => {
    onFlushSave(() => persist('auto'));
  }, [onFlushSave, persist]);

  const runFamilyAction = useCallback(
    async (action: () => Promise<void>, successMessage: string) => {
      try {
        await action();
        await onRefresh();
        onSaveNotice(successMessage);
      } catch (e) {
        onSaveNotice((e as Error).message, 'error');
      }
    },
    [onRefresh, onSaveNotice]
  );

  const runFamilyUnlink = useCallback(
    async (undoAction: UndoAction, action: () => Promise<void>, successMessage: string) => {
      try {
        await window.api.undo.push(undoAction);
        await action();
        await onRefresh();
        onSaveNotice(successMessage);
      } catch (e) {
        onSaveNotice((e as Error).message, 'error');
      }
    },
    [onRefresh, onSaveNotice]
  );

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

  const allEvents = useMemo(() => {
    const list = [...(person.birthEvent ? [person.birthEvent] : []), ...(person.deathEvent ? [person.deathEvent] : []), ...person.events];
    if (person.isLiving) {
      return list.filter((ev) => !DEATH_RELATED_EVENTS.has(ev.type));
    }
    return list;
  }, [person]);

  const addableEventTypes = useMemo(
    () => ADDABLE_EVENT_TYPES.filter(([code]) => !person.isLiving || !DEATH_RELATED_EVENTS.has(code)),
    [person.isLiving]
  );

  const handleSave = async () => {
    await persist('manual');
  };

  const addRelative = async (kind: 'partner' | 'child' | 'parent' | 'sibling') => {
    const input = { firstName: '', lastName: '', sex: 'unknown' as const };
    let created;
    if (kind === 'partner') {
      created = await window.api.family.addPartner(person.id, input);
    } else if (kind === 'child') {
      created = await window.api.family.addChild(person.id, input);
    } else if (kind === 'sibling') {
      created = await window.api.family.addSibling(person.id, input);
    } else {
      created = await window.api.family.addParents(person.id, [input]);
    }
    onSelectPerson(created.id);
    await onRefresh();
  };

  const linkExisting = async () => {
    if (!linkKind || !linkPersonId) {
      return;
    }
    try {
      if (linkKind === 'partner') {
        await window.api.family.linkPartner(person.id, linkPersonId);
      } else if (linkKind === 'child') {
        await window.api.family.linkChild(person.id, linkPersonId);
      } else if (linkKind === 'sibling') {
        await window.api.family.linkSibling(person.id, linkPersonId);
      } else {
        await window.api.family.linkParent(person.id, linkPersonId);
      }
      setLinkKind(null);
      setLinkPersonId('');
      await onRefresh();
    } catch (e) {
      setSaveError((e as Error).message);
    }
  };

  const saveEventDraft = async () => {
    const created = await window.api.events.upsert({ ...eventDraft, personId: person.id });
    if (editingEventId === 'new') {
      await window.api.undo.push({ type: 'event-delete', id: created.id });
    } else {
      const prev = allEvents.find((e) => e.id === editingEventId);
      if (prev) {
        await window.api.undo.push({ type: 'event-restore', event: snapshotEvent(prev) });
      }
    }
    setEditingEventId(null);
    await onRefresh();
  };

  const deleteEvent = async (ev: LifeEvent) => {
    if (!window.confirm('Удалить это событие?')) {
      return;
    }
    await window.api.undo.push({ type: 'event-restore', event: snapshotEvent(ev) });
    await window.api.events.delete(ev.id);
    if (ev.type === 'death') {
      await window.api.people.update({ id: person.id, isLiving: true, death: null });
    }
    await onRefresh();
  };

  const addAssociation = async () => {
    if (!assocPersonId) {
      return;
    }
    await window.api.associations.create({
      fromPersonId: person.id,
      toPersonId: assocPersonId,
      role: assocRole
    });
    setShowAssociationForm(false);
    setAssocPersonId('');
    await onRefresh();
  };

  const addCitation = async () => {
    try {
      if (!citeSourceId && !citeNewTitle.trim()) {
        setSaveError('Укажите источник или его название');
        return;
      }
      const created = await window.api.citations.create({
        personId: person.id,
        eventId: citeEventId || undefined,
        sourceId: citeSourceId || undefined,
        newSource: citeSourceId ? undefined : citeNewTitle.trim() ? { title: citeNewTitle.trim(), type: citeType } : undefined,
        page: citePage,
        excerpt: citeExcerpt
      });
      await window.api.undo.push({ type: 'citation-delete', id: created.id });
      setShowCiteForm(false);
      setCiteSourceId('');
      setCiteNewTitle('');
      setCitePage('');
      setCiteExcerpt('');
      setCiteEventId('');
      setSaveError('');
      await onRefresh();
    } catch (e) {
      setSaveError((e as Error).message);
    }
  };

  const handleDeletePerson = async () => {
    if (!window.confirm(`Удалить ${personLabel(person)}? Запись можно вернуть через Отменить.`)) {
      return;
    }
    await window.api.undo.push({ type: 'person-undelete', id: person.id });
    await window.api.people.delete(person.id);
    onDeleted();
  };

  const tabs = [
    ['info', 'Данные', null],
    ['family', t('family'), person.families.length || null],
    ['events', t('events'), allEvents.length || null],
    ['associations', t('associations'), person.associations.length || null],
    ['media', t('media'), person.media.length || null],
    ['sources', 'Источники', person.citations.length || null]
  ] as const;

  const showMaidenName = form.sex === 'female' || form.sex === 'unknown';
  const linkedIds = new Set(person.families.flatMap((f) => [...f.partners.map((p) => p.id), ...f.children.map((c) => c.person.id)]));

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-stone-200 overflow-hidden">
      <div className="p-4 border-b border-stone-100">
        <div className="flex items-start gap-3">
          <PersonAvatar personId={person.id} thumbUrl={person.thumbUrl} onUpdated={onRefresh} />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-serif">{personLabel(person)}</h2>
            <p className="text-sm text-stone-500 mt-1">{formatLifeSpan(person)}</p>
          </div>
          {person.isLiving && <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full shrink-0">жив</span>}
          {dirty && <span className="text-xs text-amber-700 shrink-0">не сохранено</span>}
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

        {tab === 'info' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('lastName')} value={form.lastName} placeholder={t('lastName')} onChange={(v) => setForm({ ...form, lastName: v })} />
              <Field
                label={t('firstName')}
                value={form.firstName}
                placeholder={t('firstName')}
                onChange={(v) => setForm({ ...form, firstName: v })}
              />
              <Field label={t('middleName')} value={form.middleName} onChange={(v) => setForm({ ...form, middleName: v })} />
              {showMaidenName && <Field label={t('maidenName')} value={form.maidenName} onChange={(v) => setForm({ ...form, maidenName: v })} />}
              <label className="text-sm font-medium text-stone-700">
                {t('sex')}
                <select
                  className="w-full border border-stone-300 rounded-md px-2 py-1.5 mt-1 bg-stone-50 font-normal text-stone-900"
                  value={form.sex}
                  onChange={(e) => setForm({ ...form, sex: e.target.value as typeof form.sex })}
                >
                  {Object.entries(SEX_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm mt-6">
                <input
                  type="checkbox"
                  checked={form.isLiving}
                  onChange={(e) => {
                    const isLiving = e.target.checked;
                    setForm({
                      ...form,
                      isLiving,
                      ...(isLiving ? { deathDate: emptyDate(), deathPlace: '', burialPlace: '', burialCoords: '' } : {})
                    });
                  }}
                />
                {t('living')}
              </label>
            </div>
            <PlaceField label={t('birth') + ' — ' + t('place')} value={form.birthPlace} onChange={(v) => setForm({ ...form, birthPlace: v })} />
            <DateFields label={t('birth')} value={form.birthDate} onChange={(d) => setForm({ ...form, birthDate: d })} />
            {!form.isLiving && (
              <>
                <PlaceField label={t('death') + ' — ' + t('place')} value={form.deathPlace} onChange={(v) => setForm({ ...form, deathPlace: v })} />
                <DateFields label={t('death')} value={form.deathDate} onChange={(d) => setForm({ ...form, deathDate: d })} />
                <PlaceField label={t('burialPlace')} value={form.burialPlace} onChange={(v) => setForm({ ...form, burialPlace: v })} />
                <CoordinatesField label={t('coordinates')} value={form.burialCoords} onChange={(v) => setForm({ ...form, burialCoords: v })} />
              </>
            )}
            <label className="block text-sm font-medium text-stone-700">
              {t('notes')}
              <textarea
                className="w-full border border-stone-300 rounded-md px-2 py-1.5 mt-1 min-h-[80px] bg-stone-50 font-normal text-stone-900"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
            <div className="flex items-center gap-3">
              <button className="bg-stone-800 text-white px-4 py-2 rounded-lg" onClick={() => void handleSave()}>
                {t('save')}
              </button>
              <span className="text-xs text-stone-400">Изменения сохраняются сами через секунду</span>
            </div>
          </>
        )}

        {tab === 'family' && (
          <>
            <div className="flex gap-2 flex-wrap">
              <ActionBtn label="Новый супруг(а)" onClick={() => void addRelative('partner')} />
              <ActionBtn label="Новый ребёнок" onClick={() => void addRelative('child')} />
              <ActionBtn label="Новый родитель" onClick={() => void addRelative('parent')} />
              <ActionBtn label="Новый брат/сестра" onClick={() => void addRelative('sibling')} />
              <ActionBtn label="Связать существующего" onClick={() => setLinkKind(linkKind ? null : 'partner')} />
            </div>
            {linkKind && (
              <div className="border rounded-lg p-3 space-y-2 bg-stone-50">
                <div className="flex gap-2 flex-wrap">
                  {(
                    [
                      ['partner', 'Супруг(а)'],
                      ['child', 'Ребёнок'],
                      ['parent', 'Родитель'],
                      ['sibling', 'Брат/сестра']
                    ] as const
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      className={`text-sm px-2 py-1 rounded ${linkKind === k ? 'bg-stone-800 text-white' : 'border'}`}
                      onClick={() => setLinkKind(k)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <select className="w-full border rounded px-2 py-1 text-sm" value={linkPersonId} onChange={(e) => setLinkPersonId(e.target.value)}>
                  <option value="">Выберите человека…</option>
                  {otherPeople
                    .filter((p) => !linkedIds.has(p.id) || linkKind === 'parent')
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {personLabel(p)}
                      </option>
                    ))}
                </select>
                <div className="flex gap-2">
                  <button className="text-sm bg-stone-800 text-white px-3 py-1 rounded-lg" onClick={() => void linkExisting()}>
                    Связать
                  </button>
                  <button className="text-sm border rounded-lg px-3 py-1" onClick={() => setLinkKind(null)}>
                    {t('cancel')}
                  </button>
                </div>
              </div>
            )}
            {person.families.length === 0 ? (
              <EmptyState text="Семейные связи пока не добавлены." />
            ) : (
              person.families.map((f) => {
                const isChildHere = f.children.some((c) => c.person.id === person.id);
                const selfChild = f.children.find((c) => c.person.id === person.id);
                const spouses = f.partners.filter((p) => p.id !== person.id);
                const siblings = f.children.filter((c) => c.person.id !== person.id);
                const children = isChildHere ? [] : f.children;
                return (
                  <div key={f.id} className="border border-stone-300 rounded-xl p-3 space-y-3 bg-white shadow-sm">
                    {isChildHere ? (
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="text-sm font-medium text-stone-700">Семья родителей</div>
                        <DangerBtn
                          label="отвязать от семьи"
                          onClick={() =>
                            void runFamilyUnlink(
                              {
                                type: 'family-relink-child',
                                familyId: f.id,
                                personId: person.id,
                                pedigree: selfChild?.pedigree ?? 'birth'
                              },
                              () => window.api.family.unlinkChild(f.id, person.id),
                              'Связь с семьёй удалена'
                            )
                          }
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
                          Тип союза
                          <select
                            className="border border-stone-300 rounded-md px-2 py-1 bg-stone-50 font-normal"
                            value={f.unionType}
                            onChange={(e) =>
                              void runFamilyAction(() => window.api.family.setUnionType(f.id, e.target.value as UnionType), 'Тип союза обновлён')
                            }
                          >
                            {Object.entries(UNION_TYPE_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="flex items-center gap-2 flex-wrap">
                          <DangerBtn
                            label="отвязать себя"
                            onClick={() =>
                              void runFamilyUnlink(
                                { type: 'family-relink-partner', familyId: f.id, personId: person.id },
                                () => window.api.family.unlinkPartner(f.id, person.id),
                                'Вы отвязаны от союза'
                              )
                            }
                          />
                          {f.children.length === 0 &&
                            (dissolvingFamilyId === f.id ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-stone-600">Удалить союз?</span>
                                <DangerBtn
                                  label="да"
                                  onClick={() => {
                                    void runFamilyAction(() => window.api.family.dissolveUnion(f.id, person.id), 'Союз удалён').finally(() =>
                                      setDissolvingFamilyId(null)
                                    );
                                  }}
                                />
                                <GhostBtn label="нет" onClick={() => setDissolvingFamilyId(null)} />
                              </div>
                            ) : (
                              <DangerBtn label="удалить союз" onClick={() => setDissolvingFamilyId(f.id)} />
                            ))}
                        </div>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <div className="text-xs font-medium uppercase tracking-wide text-stone-500">{isChildHere ? 'Родители' : 'Супруги'}</div>
                      {(isChildHere ? f.partners : spouses).length === 0 && <span className="text-sm text-stone-400">—</span>}
                      {(isChildHere ? f.partners : spouses).map((p) => (
                        <RelRow
                          key={p.id}
                          role={isChildHere ? 'Родитель' : spouseLabel(p.sex)}
                          person={p}
                          onOpen={() => onSelectPerson(p.id)}
                          onUnlink={() => {
                            void runFamilyUnlink(
                              { type: 'family-relink-partner', familyId: f.id, personId: p.id },
                              () => window.api.family.unlinkPartner(f.id, p.id),
                              isChildHere ? 'Родитель отвязан' : 'Супруг(а) отвязан(а)'
                            );
                          }}
                        />
                      ))}
                      {(isChildHere ? f.partners.length < 2 : f.partners.length < 2) && (
                        <select
                          className="border border-stone-300 rounded-md px-2 py-1.5 text-sm mt-1 bg-stone-50"
                          defaultValue=""
                          onChange={(e) => {
                            const id = e.target.value;
                            if (!id) {
                              return;
                            }
                            void window.api.family.linkPartnerToFamily(f.id, id).then(onRefresh);
                          }}
                        >
                          <option value="">{isChildHere ? '+ родитель' : '+ супруг / супруга'}</option>
                          {otherPeople
                            .filter((p) => !f.partners.some((x) => x.id === p.id))
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {isChildHere ? personLabel(p) : `${personLabel(p)} (${spouseLabel(p.sex).toLowerCase()})`}
                              </option>
                            ))}
                        </select>
                      )}
                    </div>
                    {isChildHere && (
                      <div className="space-y-1.5">
                        <div className="text-xs font-medium uppercase tracking-wide text-stone-500">Братья и сёстры</div>
                        {siblings.length === 0 && <span className="text-sm text-stone-400">—</span>}
                        {siblings.map(({ person: c, pedigree }) => (
                          <RelRow
                            key={c.id}
                            role={siblingLabel(c.sex)}
                            person={c}
                            onOpen={() => onSelectPerson(c.id)}
                            extra={
                              <select
                                className="border border-stone-300 rounded-md px-1.5 py-0.5 text-xs bg-white"
                                value={pedigree}
                                onChange={(e) => void window.api.family.setPedigree(f.id, c.id, e.target.value as PedigreeType).then(onRefresh)}
                              >
                                {Object.entries(PEDIGREE_LABELS).map(([k, v]) => (
                                  <option key={k} value={k}>
                                    {v}
                                  </option>
                                ))}
                              </select>
                            }
                            onUnlink={() => {
                              void runFamilyUnlink(
                                { type: 'family-relink-child', familyId: f.id, personId: c.id, pedigree },
                                () => window.api.family.unlinkChild(f.id, c.id),
                                'Связь удалена'
                              );
                            }}
                          />
                        ))}
                        <select
                          className="border border-stone-300 rounded-md px-2 py-1.5 text-sm mt-1 bg-stone-50"
                          defaultValue=""
                          onChange={(e) => {
                            const id = e.target.value;
                            if (!id) {
                              return;
                            }
                            void window.api.family.linkChildToFamily(f.id, id).then(onRefresh);
                          }}
                        >
                          <option value="">+ брат / сестра</option>
                          {otherPeople
                            .filter((p) => !f.children.some((x) => x.person.id === p.id) && !f.partners.some((x) => x.id === p.id))
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {personLabel(p)} ({siblingLabel(p.sex).toLowerCase()})
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                    {!isChildHere && (
                      <div className="space-y-1.5">
                        <div className="text-xs font-medium uppercase tracking-wide text-stone-500">Дети</div>
                        {children.length === 0 && <span className="text-sm text-stone-400">—</span>}
                        {children.map(({ person: c, pedigree }) => (
                          <RelRow
                            key={c.id}
                            person={c}
                            onOpen={() => onSelectPerson(c.id)}
                            extra={
                              <select
                                className="border border-stone-300 rounded-md px-1.5 py-0.5 text-xs bg-white"
                                value={pedigree}
                                onChange={(e) => void window.api.family.setPedigree(f.id, c.id, e.target.value as PedigreeType).then(onRefresh)}
                              >
                                {Object.entries(PEDIGREE_LABELS).map(([k, v]) => (
                                  <option key={k} value={k}>
                                    {v}
                                  </option>
                                ))}
                              </select>
                            }
                            onUnlink={() => {
                              void runFamilyUnlink(
                                { type: 'family-relink-child', familyId: f.id, personId: c.id, pedigree },
                                () => window.api.family.unlinkChild(f.id, c.id),
                                'Связь удалена'
                              );
                            }}
                          />
                        ))}
                        <select
                          className="border border-stone-300 rounded-md px-2 py-1.5 text-sm mt-1 bg-stone-50"
                          defaultValue=""
                          onChange={(e) => {
                            const id = e.target.value;
                            if (!id) {
                              return;
                            }
                            void window.api.family.linkChildToFamily(f.id, id).then(onRefresh);
                          }}
                        >
                          <option value="">+ ребёнок в этот союз</option>
                          {otherPeople
                            .filter((p) => !f.children.some((x) => x.person.id === p.id) && !f.partners.some((x) => x.id === p.id))
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {personLabel(p)}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}

        {tab === 'events' && (
          <>
            {editingEventId === null && (
              <ActionBtn
                label={t('addEvent')}
                onClick={() => {
                  setEventDraft({
                    type: 'residence',
                    personId: person.id,
                    placeName: '',
                    description: '',
                    date: emptyDate()
                  });
                  setEditingEventId('new');
                }}
              />
            )}
            {editingEventId !== null && (
              <div className="border rounded-lg p-3 space-y-2 bg-stone-50">
                <label className="block text-sm">
                  Тип события
                  <select
                    className="w-full border rounded px-2 py-1 mt-1"
                    value={eventDraft.type}
                    onChange={(e) => setEventDraft({ ...eventDraft, type: e.target.value as EventTypeCode })}
                    disabled={editingEventId !== 'new'}
                  >
                    {(editingEventId === 'new' ? addableEventTypes : Object.entries(EVENT_TYPE_LABELS)).map(([code, label]) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <PlaceField value={eventDraft.placeName ?? ''} onChange={(v) => setEventDraft({ ...eventDraft, placeName: v })} />
                <DateFields value={eventDraft.date} onChange={(d) => setEventDraft({ ...eventDraft, date: d })} />
                <label className="block text-sm">
                  Описание
                  <textarea
                    className="w-full border rounded px-2 py-1 mt-1"
                    value={eventDraft.description ?? ''}
                    onChange={(e) => setEventDraft({ ...eventDraft, description: e.target.value })}
                  />
                </label>
                <div className="flex gap-2">
                  <button className="text-sm bg-stone-800 text-white px-3 py-1 rounded-lg" onClick={() => void saveEventDraft()}>
                    {t('save')}
                  </button>
                  <button className="text-sm border rounded-lg px-3 py-1" onClick={() => setEditingEventId(null)}>
                    {t('cancel')}
                  </button>
                </div>
              </div>
            )}
            {allEvents.length === 0 && editingEventId === null ? (
              <EmptyState text="События жизни пока не добавлены." />
            ) : (
              <ul className="space-y-2">
                {allEvents.map((ev) => (
                  <li key={ev.id} className="border border-stone-300 rounded-lg p-2.5 text-sm bg-stone-50">
                    <div className="flex justify-between gap-2">
                      <strong className="text-stone-900">{EVENT_TYPE_LABELS[ev.type] ?? ev.customLabel ?? ev.type}</strong>
                      <div className="flex gap-1.5 shrink-0">
                        <GhostBtn
                          label="Изменить"
                          onClick={() => {
                            setEventDraft(snapshotEvent(ev));
                            setEditingEventId(ev.id);
                          }}
                        />
                        {ev.type !== 'birth' && <DangerBtn label={t('delete')} onClick={() => void deleteEvent(ev)} />}
                      </div>
                    </div>
                    <div className="text-stone-800 mt-1 font-medium">
                      {formatDate(ev.date)}
                      {ev.placeName ? ` · ${ev.placeName}` : ''}
                    </div>
                    {ev.description && <div className="text-stone-600 mt-0.5">{ev.description}</div>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === 'associations' && (
          <>
            {!showAssociationForm ? (
              <ActionBtn
                label={t('addAssociation')}
                onClick={() => {
                  setAssocPersonId(otherPeople[0]?.id ?? '');
                  setShowAssociationForm(true);
                }}
                disabled={otherPeople.length === 0}
              />
            ) : (
              <div className="border rounded-lg p-3 space-y-2 bg-stone-50">
                <label className="block text-sm">
                  Человек
                  <select className="w-full border rounded px-2 py-1 mt-1" value={assocPersonId} onChange={(e) => setAssocPersonId(e.target.value)}>
                    {otherPeople.map((p) => (
                      <option key={p.id} value={p.id}>
                        {personLabel(p)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Роль
                  <select
                    className="w-full border rounded px-2 py-1 mt-1"
                    value={assocRole}
                    onChange={(e) => setAssocRole(e.target.value as CreateAssociationInput['role'])}
                  >
                    {Object.entries(ASSOCIATION_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex gap-2">
                  <button className="text-sm bg-stone-800 text-white px-3 py-1 rounded-lg" onClick={() => void addAssociation()}>
                    Добавить
                  </button>
                  <button className="text-sm border rounded-lg px-3 py-1" onClick={() => setShowAssociationForm(false)}>
                    {t('cancel')}
                  </button>
                </div>
              </div>
            )}
            {otherPeople.length === 0 && !showAssociationForm && <EmptyState text="Добавьте ещё людей в проект, чтобы создать ассоциации." />}
            {person.associations.length === 0 && otherPeople.length > 0 && !showAssociationForm ? (
              <EmptyState text="Ассоциации (крёстные, свидетели и др.) пока не добавлены." />
            ) : person.associations.length > 0 ? (
              <ul className="space-y-2">
                {person.associations.map((a) => (
                  <li key={a.id} className="border border-stone-300 rounded-lg p-2.5 text-sm flex justify-between gap-2 bg-stone-50 items-center">
                    <span>
                      <span className="text-xs font-medium text-stone-500">{ASSOCIATION_LABELS[a.role] ?? a.customRole}</span>
                      {': '}
                      <button className="font-semibold text-stone-900 hover:underline" onClick={() => onSelectPerson(a.toPerson.id)}>
                        {personLabel(a.toPerson)}
                      </button>
                    </span>
                    <DangerBtn label={t('delete')} onClick={() => void window.api.associations.delete(a.id).then(onRefresh)} />
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}

        {tab === 'media' && (
          <>
            <ActionBtn label={t('addMedia')} onClick={() => void window.api.media.add({ personId: person.id }).then(onRefresh)} />
            {person.media.length === 0 ? (
              <EmptyState text="Фото и документы пока не прикреплены." />
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {person.media.map((m) => (
                  <div key={m.id} className="border border-stone-300 rounded-lg p-2 text-center bg-stone-50">
                    {m.thumbUrl ? (
                      <img src={m.thumbUrl} alt="" className="w-full h-24 object-cover rounded mb-1" />
                    ) : (
                      <div className="h-24 bg-stone-100 flex items-center justify-center text-xs">{m.fileName}</div>
                    )}
                    <div className="text-xs font-medium truncate text-stone-900">{m.fileName}</div>
                    <div className="flex gap-1 justify-center mt-1.5 flex-wrap">
                      <GhostBtn label="Открыть" onClick={() => void window.api.media.open(m.id)} />
                      {!m.isPrimary && <GhostBtn label="Главное" onClick={() => void window.api.media.setPrimary(person.id, m.id).then(onRefresh)} />}
                      <DangerBtn
                        label={t('delete')}
                        onClick={() => {
                          if (window.confirm('Удалить файл из проекта?')) {
                            void window.api.media.delete(m.id).then(onRefresh);
                          }
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'sources' && (
          <>
            {!showCiteForm ? (
              <ActionBtn label="Добавить цитату" onClick={() => setShowCiteForm(true)} />
            ) : (
              <div className="border rounded-lg p-3 space-y-2 bg-stone-50">
                <label className="block text-sm">
                  Существующий источник
                  <select className="w-full border rounded px-2 py-1 mt-1" value={citeSourceId} onChange={(e) => setCiteSourceId(e.target.value)}>
                    <option value="">Новый источник</option>
                    {sources.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </label>
                {!citeSourceId && (
                  <>
                    <Field label="Название источника" value={citeNewTitle} onChange={setCiteNewTitle} />
                    <label className="block text-sm">
                      Тип
                      <select
                        className="w-full border rounded px-2 py-1 mt-1"
                        value={citeType}
                        onChange={(e) => setCiteType(e.target.value as SourceType)}
                      >
                        {Object.entries(SOURCE_TYPE_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
                <label className="block text-sm">
                  Событие (необязательно)
                  <select className="w-full border rounded px-2 py-1 mt-1" value={citeEventId} onChange={(e) => setCiteEventId(e.target.value)}>
                    <option value="">К карточке человека</option>
                    {allEvents.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {EVENT_TYPE_LABELS[ev.type] ?? ev.type} · {formatDate(ev.date)}
                      </option>
                    ))}
                  </select>
                </label>
                <Field label="Страница / лист" value={citePage} onChange={setCitePage} />
                <label className="block text-sm">
                  Выдержка
                  <textarea className="w-full border rounded px-2 py-1 mt-1" value={citeExcerpt} onChange={(e) => setCiteExcerpt(e.target.value)} />
                </label>
                <div className="flex gap-2">
                  <button className="text-sm bg-stone-800 text-white px-3 py-1 rounded-lg" onClick={() => void addCitation()}>
                    Добавить
                  </button>
                  <button className="text-sm border rounded-lg px-3 py-1" onClick={() => setShowCiteForm(false)}>
                    {t('cancel')}
                  </button>
                </div>
              </div>
            )}
            {person.citations.length === 0 && !showCiteForm ? (
              <EmptyState text="Источники и цитаты пока не добавлены." />
            ) : (
              <ul className="space-y-2">
                {person.citations.map((c) => (
                  <li key={c.id} className="border border-stone-300 rounded-lg p-2.5 text-sm bg-stone-50">
                    <div className="flex justify-between gap-2">
                      <div>
                        <strong className="text-stone-900">{c.source.title}</strong>
                        <span className="text-stone-600"> · {SOURCE_TYPE_LABELS[c.source.type] ?? c.source.type}</span>
                        {c.page && <div className="text-stone-800 font-medium">стр. {c.page}</div>}
                        {c.excerpt && <div className="text-stone-600 italic">{c.excerpt}</div>}
                        {c.eventId && (
                          <div className="text-xs text-stone-500 mt-0.5">
                            к событию: {EVENT_TYPE_LABELS[allEvents.find((e) => e.id === c.eventId)?.type ?? ''] ?? 'событие'}
                          </div>
                        )}
                      </div>
                      <DangerBtn
                        label={t('delete')}
                        onClick={() => {
                          void window.api.undo
                            .push({ type: 'citation-restore', id: c.id })
                            .then(() => window.api.citations.delete(c.id))
                            .then(onRefresh);
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <label className="text-sm font-medium text-stone-700 block">
      {label}
      <input
        className="w-full border border-stone-300 rounded-md px-2 py-1.5 mt-1 bg-stone-50 font-normal text-stone-900"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function ActionBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      className="text-sm border border-stone-300 rounded-lg px-3 py-1 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed"
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

function GhostBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="text-xs border border-stone-300 text-stone-700 rounded-md px-2 py-0.5 hover:bg-white shrink-0" onClick={onClick}>
      {label}
    </button>
  );
}

function DangerBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="text-xs border border-red-300 text-red-700 rounded-md px-2 py-0.5 hover:bg-red-50 shrink-0" onClick={onClick}>
      {label}
    </button>
  );
}

function RelRow({
  role,
  person,
  onOpen,
  extra,
  onUnlink
}: {
  role?: string;
  person: {
    firstName: string;
    lastName: string;
    middleName?: string | null;
    isLiving: boolean;
    birthYear?: number | null;
    deathYear?: number | null;
    sex?: Sex;
  };
  onOpen: () => void;
  extra?: ReactNode;
  onUnlink: () => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap rounded-lg border border-stone-300 bg-stone-50 px-2.5 py-1.5">
      {role && <span className="text-xs font-medium text-stone-500 w-[4.75rem] shrink-0">{role}</span>}
      <button type="button" className="font-semibold text-stone-900 hover:underline text-left min-w-0 truncate" onClick={onOpen}>
        {personLabel(person)}
      </button>
      <span className="text-xs text-stone-600 shrink-0">{formatLifeSpan(person)}</span>
      {extra}
      <span className="ml-auto">
        <DangerBtn label="отвязать" onClick={onUnlink} />
      </span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-stone-400 text-center py-6">{text}</p>;
}
