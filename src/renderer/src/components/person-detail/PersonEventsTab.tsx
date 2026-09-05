import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PersonDetail, UpsertEventInput, EventTypeCode, LifeEvent } from '@shared/types';
import { DateFields } from '../DateFields';
import { PlaceField } from '../PlaceField';
import { formatDate, eventTypeLabel, ADDABLE_EVENT_TYPE_CODES, EVENT_TYPE_CODES, DEATH_RELATED_EVENTS, emptyDate } from '../../lib/labels';
import { snapshotEvent } from './helpers';
import { ActionBtn, DangerBtn, EmptyState, GhostBtn } from './ui';

interface Props {
  person: PersonDetail;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}

export function PersonEventsTab({ person, onRefresh, onError }: Props) {
  const { t, i18n } = useTranslation();
  const [editingEventId, setEditingEventId] = useState<string | 'new' | null>(null);
  const [eventDraft, setEventDraft] = useState<UpsertEventInput>({
    type: 'residence',
    personId: person.id,
    placeName: '',
    description: '',
    date: emptyDate()
  });

  const allEvents = useMemo(() => {
    const list = [...(person.birthEvent ? [person.birthEvent] : []), ...(person.deathEvent ? [person.deathEvent] : []), ...person.events];
    if (person.isLiving) {
      return list.filter((ev) => !DEATH_RELATED_EVENTS.has(ev.type));
    }
    return list;
  }, [person]);

  const addableEventTypes = useMemo(
    () => ADDABLE_EVENT_TYPE_CODES.filter((code) => !person.isLiving || !DEATH_RELATED_EVENTS.has(code)),
    [person.isLiving, i18n.language]
  );

  const eventTypeOptions = useMemo(() => {
    const codes = editingEventId === 'new' ? addableEventTypes : [...EVENT_TYPE_CODES];
    return codes.map((code) => [code, eventTypeLabel(code)] as const);
  }, [editingEventId, addableEventTypes, i18n.language]);

  const saveEventDraft = async () => {
    try {
      await window.api.events.upsert({ ...eventDraft, personId: person.id });
      setEditingEventId(null);
      await onRefresh();
    } catch (e) {
      onError((e as Error).message);
    }
  };

  const deleteEvent = async (ev: LifeEvent) => {
    const confirmed = await window.api.dialog.confirm({
      message: t('deleteEventConfirm'),
      destructive: true
    });
    if (!confirmed) {
      return;
    }
    try {
      await window.api.events.delete(ev.id);
      if (ev.type === 'death') {
        await window.api.people.update({ id: person.id, isLiving: true, death: null });
      }
      await onRefresh();
    } catch (e) {
      onError((e as Error).message);
    }
  };

  return (
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
            {t('eventType')}
            <select
              className="w-full border rounded px-2 py-1 mt-1"
              value={eventDraft.type}
              onChange={(e) => setEventDraft({ ...eventDraft, type: e.target.value as EventTypeCode })}
              disabled={editingEventId !== 'new'}
            >
              {eventTypeOptions.map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <PlaceField value={eventDraft.placeName ?? ''} onChange={(v) => setEventDraft({ ...eventDraft, placeName: v })} />
          <DateFields value={eventDraft.date} onChange={(d) => setEventDraft({ ...eventDraft, date: d })} />
          <label className="block text-sm">
            {t('description')}
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
        <EmptyState text={t('personDetail.emptyEvents')} />
      ) : (
        <ul className="space-y-2">
          {allEvents.map((ev) => (
            <li key={ev.id} className="border border-stone-300 rounded-lg p-2.5 text-sm bg-stone-50">
              <div className="flex justify-between gap-2">
                <strong className="text-stone-900">{eventTypeLabel(ev.type) || ev.customLabel || ev.type}</strong>
                <div className="flex gap-1.5 shrink-0">
                  <GhostBtn
                    label={t('personDetail.editEvent')}
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
  );
}
