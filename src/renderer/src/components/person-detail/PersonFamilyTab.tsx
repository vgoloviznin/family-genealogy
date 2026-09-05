import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Person, PersonDetail, UnionType, PedigreeType } from '@shared/types';
import { personLabel, pedigreeLabel, unionTypeLabel, spouseLabel, siblingLabel, UNION_TYPE_CODES, PEDIGREE_CODES } from '../../lib/labels';
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
  const [childFamilyId, setChildFamilyId] = useState<string | 'new' | ''>('');

  const partnerFamilies = person.families.filter((f) => f.partners.some((p) => p.id === person.id));

  useEffect(() => {
    setChildFamilyId('');
  }, [person.id]);

  const runFamilyAction = async (action: () => Promise<void>, successMessage: string) => {
    try {
      await action();
      await onRefresh();
      onSaveNotice(successMessage);
    } catch (e) {
      onSaveNotice((e as Error).message, 'error');
    }
  };

  const runFamilyUnlink = runFamilyAction;

  const addRelative = async (kind: 'partner' | 'child' | 'parent' | 'sibling', familyId?: string | 'new') => {
    await runFamilyAction(async () => {
      const input = { firstName: '', lastName: '', sex: 'unknown' as const };
      let created;
      if (kind === 'partner') {
        created = await window.api.family.addPartner(person.id, input);
      } else if (kind === 'child') {
        if (familyId && familyId !== 'new') {
          created = await window.api.family.addChildToFamily(familyId, input);
        } else {
          created = await window.api.family.addChild(person.id, input, 'birth', familyId === 'new' ? 'new' : undefined);
        }
      } else if (kind === 'sibling') {
        created = await window.api.family.addSibling(person.id, input);
      } else {
        created = await window.api.family.addParents(person.id, [input]);
      }
      onSelectPerson(created.id);
    }, t('personDetail.saved'));
  };

  const linkExisting = async () => {
    if (!linkKind || !linkPersonId) {
      return;
    }
    try {
      if (linkKind === 'partner') {
        await window.api.family.linkPartner(person.id, linkPersonId);
      } else if (linkKind === 'child') {
        if (partnerFamilies.length >= 2) {
          if (!childFamilyId) {
            onSaveNotice(t('errors.familyChoiceRequired'), 'error');
            return;
          }
          await window.api.family.linkChild(person.id, linkPersonId, 'birth', childFamilyId === 'new' ? 'new' : childFamilyId);
        } else {
          await window.api.family.linkChild(person.id, linkPersonId);
        }
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
      <div className="flex gap-2 flex-wrap items-center">
        <ActionBtn label={t('personDetail.newPartner')} onClick={() => void addRelative('partner')} />
        {partnerFamilies.length >= 2 ? (
          <>
            <select
              className="border border-stone-300 rounded-md px-2 py-1 text-sm bg-stone-50"
              value={childFamilyId}
              onChange={(e) => setChildFamilyId(e.target.value as string | 'new')}
            >
              <option value="">{t('personDetail.chooseUnionForChild')}</option>
              {partnerFamilies.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.partners
                    .filter((p) => p.id !== person.id)
                    .map((p) => personLabel(p))
                    .join(' / ') || t('personDetail.unionType')}
                </option>
              ))}
              <option value="new">{t('personDetail.newUnionForChild')}</option>
            </select>
            <ActionBtn
              label={t('personDetail.newChild')}
              onClick={() => {
                if (!childFamilyId) {
                  onSaveNotice(t('errors.familyChoiceRequired'), 'error');
                  return;
                }
                void addRelative('child', childFamilyId === 'new' ? 'new' : childFamilyId);
              }}
            />
          </>
        ) : (
          <ActionBtn label={t('personDetail.newChild')} onClick={() => void addRelative('child')} />
        )}
        <ActionBtn label={t('personDetail.newParent')} onClick={() => void addRelative('parent')} />
        <ActionBtn label={t('personDetail.newSibling')} onClick={() => void addRelative('sibling')} />
        <ActionBtn label={t('personDetail.linkExisting')} onClick={() => setLinkKind(linkKind ? null : 'partner')} />
      </div>
      {linkKind && (
        <div className="border rounded-lg p-3 space-y-2 bg-stone-50">
          <div className="flex gap-2 flex-wrap">
            {(
              [
                ['partner', t('personDetail.linkKindPartner')],
                ['child', t('personDetail.linkKindChild')],
                ['parent', t('personDetail.linkKindParent')],
                ['sibling', t('personDetail.linkKindSibling')]
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
            <option value="">{t('personDetail.selectPerson')}</option>
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
              {t('personDetail.link')}
            </button>
            <button className="text-sm border rounded-lg px-3 py-1" onClick={() => setLinkKind(null)}>
              {t('cancel')}
            </button>
          </div>
        </div>
      )}
      {person.families.length === 0 ? (
        <EmptyState text={t('personDetail.emptyFamily')} />
      ) : (
        person.families.map((f) => {
          const isChildHere = f.children.some((c) => c.person.id === person.id);
          const spouses = f.partners.filter((p) => p.id !== person.id);
          const siblings = f.children.filter((c) => c.person.id !== person.id);
          const children = isChildHere ? [] : f.children;
          return (
            <div key={f.id} className="border border-stone-300 rounded-xl p-3 space-y-3 bg-white shadow-sm">
              {isChildHere ? (
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-sm font-medium text-stone-700">{t('personDetail.parentsFamily')}</div>
                  <DangerBtn
                    label={t('personDetail.unlinkFromFamily')}
                    onClick={() => void runFamilyUnlink(() => window.api.family.unlinkChild(f.id, person.id), t('personDetail.familyLinkRemoved'))}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
                    {t('personDetail.unionType')}
                    <select
                      className="border border-stone-300 rounded-md px-2 py-1 bg-stone-50 font-normal"
                      value={f.unionType}
                      onChange={(e) =>
                        void runFamilyAction(
                          () => window.api.family.setUnionType(f.id, e.target.value as UnionType),
                          t('personDetail.unionTypeUpdated')
                        )
                      }
                    >
                      {UNION_TYPE_CODES.map((k) => (
                        <option key={k} value={k}>
                          {unionTypeLabel(k)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <DangerBtn
                      label={t('personDetail.unlinkSelf')}
                      onClick={() =>
                        void runFamilyUnlink(() => window.api.family.unlinkPartner(f.id, person.id), t('personDetail.unlinkedFromUnion'))
                      }
                    />
                    {f.children.length === 0 &&
                      (dissolvingFamilyId === f.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-stone-600">{t('personDetail.dissolveUnionConfirm')}</span>
                          <DangerBtn
                            label={t('yes')}
                            onClick={() => {
                              void runFamilyAction(() => window.api.family.dissolveUnion(f.id, person.id), t('personDetail.unionDissolved')).finally(
                                () => setDissolvingFamilyId(null)
                              );
                            }}
                          />
                          <GhostBtn label={t('no')} onClick={() => setDissolvingFamilyId(null)} />
                        </div>
                      ) : (
                        <DangerBtn label={t('personDetail.dissolveUnion')} onClick={() => setDissolvingFamilyId(f.id)} />
                      ))}
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <div className="text-xs font-medium uppercase tracking-wide text-stone-500">
                  {isChildHere ? t('personDetail.parents') : t('personDetail.spouses')}
                </div>
                {(isChildHere ? f.partners : spouses).length === 0 && <span className="text-sm text-stone-400">—</span>}
                {(isChildHere ? f.partners : spouses).map((p) => (
                  <RelRow
                    key={p.id}
                    role={isChildHere ? t('personDetail.parentRole') : spouseLabel(p.sex)}
                    person={p}
                    onOpen={() => onSelectPerson(p.id)}
                    onUnlink={() => {
                      void runFamilyUnlink(
                        () => window.api.family.unlinkPartner(f.id, p.id),
                        isChildHere ? t('personDetail.parentUnlinked') : t('personDetail.spouseUnlinked')
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
                      void runFamilyAction(() => window.api.family.linkPartnerToFamily(f.id, id).then(() => undefined), t('personDetail.saved'));
                    }}
                  >
                    <option value="">{isChildHere ? t('personDetail.addParentOption') : t('personDetail.addSpouseOption')}</option>
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
                  <div className="text-xs font-medium uppercase tracking-wide text-stone-500">{t('personDetail.siblings')}</div>
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
                          onChange={(e) =>
                            void runFamilyAction(
                              () => window.api.family.setPedigree(f.id, c.id, e.target.value as PedigreeType),
                              t('personDetail.saved')
                            )
                          }
                        >
                          {PEDIGREE_CODES.map((k) => (
                            <option key={k} value={k}>
                              {pedigreeLabel(k)}
                            </option>
                          ))}
                        </select>
                      }
                      onUnlink={() => {
                        void runFamilyUnlink(() => window.api.family.unlinkChild(f.id, c.id), t('personDetail.linkRemoved'));
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
                      void runFamilyAction(() => window.api.family.linkChildToFamily(f.id, id).then(() => undefined), t('personDetail.saved'));
                    }}
                  >
                    <option value="">{t('personDetail.addSiblingOption')}</option>
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
                  <div className="text-xs font-medium uppercase tracking-wide text-stone-500">{t('personDetail.children')}</div>
                  {children.length === 0 && <span className="text-sm text-stone-400">—</span>}
                  <ActionBtn label={t('personDetail.newChild')} onClick={() => void addRelative('child', f.id)} />
                  {children.map(({ person: c, pedigree }) => (
                    <RelRow
                      key={c.id}
                      person={c}
                      onOpen={() => onSelectPerson(c.id)}
                      extra={
                        <select
                          className="border border-stone-300 rounded-md px-1.5 py-0.5 text-xs bg-white"
                          value={pedigree}
                          onChange={(e) =>
                            void runFamilyAction(
                              () => window.api.family.setPedigree(f.id, c.id, e.target.value as PedigreeType),
                              t('personDetail.saved')
                            )
                          }
                        >
                          {PEDIGREE_CODES.map((k) => (
                            <option key={k} value={k}>
                              {pedigreeLabel(k)}
                            </option>
                          ))}
                        </select>
                      }
                      onUnlink={() => {
                        void runFamilyUnlink(() => window.api.family.unlinkChild(f.id, c.id), t('personDetail.linkRemoved'));
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
                      void runFamilyAction(() => window.api.family.linkChildToFamily(f.id, id).then(() => undefined), t('personDetail.saved'));
                    }}
                  >
                    <option value="">{t('personDetail.addChildToUnion')}</option>
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
