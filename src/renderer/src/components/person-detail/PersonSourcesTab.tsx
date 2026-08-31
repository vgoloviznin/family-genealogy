import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PersonDetail, Source, SourceType, LifeEvent } from '@shared/types';
import { formatDate, EVENT_TYPE_LABELS, SOURCE_TYPE_LABELS, DEATH_RELATED_EVENTS } from '../../lib/labels';
import { ActionBtn, DangerBtn, EmptyState, Field } from './ui';

interface Props {
  person: PersonDetail;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}

export function PersonSourcesTab({ person, onRefresh, onError }: Props) {
  const { t } = useTranslation();
  const [sources, setSources] = useState<Source[]>([]);
  const [citeSourceId, setCiteSourceId] = useState('');
  const [citeNewTitle, setCiteNewTitle] = useState('');
  const [citeType, setCiteType] = useState<SourceType>('document');
  const [citePage, setCitePage] = useState('');
  const [citeExcerpt, setCiteExcerpt] = useState('');
  const [citeEventId, setCiteEventId] = useState('');
  const [showCiteForm, setShowCiteForm] = useState(false);

  useEffect(() => {
    void window.api.sources.list().then(setSources);
  }, [person.id, person.citations.length]);

  const allEvents = useMemo(() => {
    const list: LifeEvent[] = [
      ...(person.birthEvent ? [person.birthEvent] : []),
      ...(person.deathEvent ? [person.deathEvent] : []),
      ...person.events
    ];
    if (person.isLiving) {
      return list.filter((ev) => !DEATH_RELATED_EVENTS.has(ev.type));
    }
    return list;
  }, [person]);

  const addCitation = async () => {
    try {
      if (!citeSourceId && !citeNewTitle.trim()) {
        onError('Укажите источник или его название');
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
      onError('');
      await onRefresh();
    } catch (e) {
      onError((e as Error).message);
    }
  };

  return (
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
                <select className="w-full border rounded px-2 py-1 mt-1" value={citeType} onChange={(e) => setCiteType(e.target.value as SourceType)}>
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
  );
}
