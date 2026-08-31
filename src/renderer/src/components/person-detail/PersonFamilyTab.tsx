import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Person, PersonDetail, UndoAction, UnionType, PedigreeType } from '@shared/types';
import { personLabel, PEDIGREE_LABELS, UNION_TYPE_LABELS, spouseLabel, siblingLabel } from '../../lib/labels';
import { ActionBtn, DangerBtn, EmptyState, GhostBtn, RelRow } from './ui';

interface Props {
  person: PersonDetail;
  otherPeople: Person[];
  onSelectPerson: (id: string) => void;
  onRefresh: () => Promise<void>;
  onSaveNotice: (message: string, variant?: 'info' | 'error') => void;
}

export function PersonFamilyTab({ person, otherPeople, onSelectPerson, onRefresh, onSaveNotice }: Props) {
  const { t } = useTranslation();
  const [linkKind, setLinkKind] = useState<'partner' | 'child' | 'parent' | 'sibling' | null>(null);
  const [linkPersonId, setLinkPersonId] = useState('');
  const [dissolvingFamilyId, setDissolvingFamilyId] = useState<string | null>(null);

  const runFamilyAction = async (action: () => Promise<void>, successMessage: string) => {
    try {
      await action();
      await onRefresh();
      onSaveNotice(successMessage);
    } catch (e) {
      onSaveNotice((e as Error).message, 'error');
    }
  };

  const runFamilyUnlink = async (undoAction: UndoAction, action: () => Promise<void>, successMessage: string) => {
    try {
      await window.api.undo.push(undoAction);
      await action();
      await onRefresh();
      onSaveNotice(successMessage);
    } catch (e) {
      onSaveNotice((e as Error).message, 'error');
    }
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
      onSaveNotice((e as Error).message, 'error');
    }
  };

  const linkedIds = new Set(person.families.flatMap((f) => [...f.partners.map((p) => p.id), ...f.children.map((c) => c.person.id)]));

  return (
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
  );
}
