import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PersonDetail, CreateAssociationInput, Person } from '@shared/types';
import { personLabel, ASSOCIATION_LABELS } from '../../lib/labels';
import { ActionBtn, DangerBtn, EmptyState } from './ui';

interface Props {
  person: PersonDetail;
  otherPeople: Person[];
  onSelectPerson: (id: string) => void;
  onRefresh: () => Promise<void>;
}

export function PersonAssociationsTab({ person, otherPeople, onSelectPerson, onRefresh }: Props) {
  const { t } = useTranslation();
  const [showAssociationForm, setShowAssociationForm] = useState(false);
  const [assocPersonId, setAssocPersonId] = useState('');
  const [assocRole, setAssocRole] = useState<CreateAssociationInput['role']>('godparent');

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

  return (
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
  );
}
