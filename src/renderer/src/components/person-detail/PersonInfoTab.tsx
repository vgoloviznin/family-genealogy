import { useTranslation } from 'react-i18next';
import { DateFields } from '../DateFields';
import { PlaceField } from '../PlaceField';
import { CoordinatesField } from '../CoordinatesField';
import { SEX_CODES, sexLabel, emptyDate } from '../../lib/labels';
import { Field } from './ui';
import type { PersonFormState } from './helpers';

interface Props {
  form: PersonFormState;
  onChange: (form: PersonFormState) => void;
  onSave: () => void;
}

export function PersonInfoTab({ form, onChange, onSave }: Props) {
  const { t } = useTranslation();
  const showMaidenName = form.sex === 'female' || form.sex === 'unknown';

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('lastName')} value={form.lastName} placeholder={t('lastName')} onChange={(v) => onChange({ ...form, lastName: v })} />
        <Field label={t('firstName')} value={form.firstName} placeholder={t('firstName')} onChange={(v) => onChange({ ...form, firstName: v })} />
        <Field label={t('middleName')} value={form.middleName} onChange={(v) => onChange({ ...form, middleName: v })} />
        {showMaidenName && <Field label={t('maidenName')} value={form.maidenName} onChange={(v) => onChange({ ...form, maidenName: v })} />}
        <label className="text-sm font-medium text-stone-700">
          {t('sex')}
          <select
            className="w-full border border-stone-300 rounded-md px-2 py-1.5 mt-1 bg-stone-50 font-normal text-stone-900"
            value={form.sex}
            onChange={(e) => onChange({ ...form, sex: e.target.value as typeof form.sex })}
          >
            {SEX_CODES.map((k) => (
              <option key={k} value={k}>
                {sexLabel(k)}
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
              onChange({
                ...form,
                isLiving,
                ...(isLiving ? { deathDate: emptyDate(), deathPlace: '', burialPlace: '', burialCoords: '' } : {})
              });
            }}
          />
          {t('living')}
        </label>
      </div>
      <PlaceField label={t('birth') + ' — ' + t('place')} value={form.birthPlace} onChange={(v) => onChange({ ...form, birthPlace: v })} />
      <DateFields label={t('birth')} value={form.birthDate} onChange={(d) => onChange({ ...form, birthDate: d })} />
      {!form.isLiving && (
        <>
          <PlaceField label={t('death') + ' — ' + t('place')} value={form.deathPlace} onChange={(v) => onChange({ ...form, deathPlace: v })} />
          <DateFields label={t('death')} value={form.deathDate} onChange={(d) => onChange({ ...form, deathDate: d })} />
          <PlaceField label={t('burialPlace')} value={form.burialPlace} onChange={(v) => onChange({ ...form, burialPlace: v })} />
          <CoordinatesField label={t('coordinates')} value={form.burialCoords} onChange={(v) => onChange({ ...form, burialCoords: v })} />
        </>
      )}
      <label className="block text-sm font-medium text-stone-700">
        {t('notes')}
        <textarea
          className="w-full border border-stone-300 rounded-md px-2 py-1.5 mt-1 min-h-[80px] bg-stone-50 font-normal text-stone-900"
          value={form.notes}
          onChange={(e) => onChange({ ...form, notes: e.target.value })}
        />
      </label>
      <div className="flex items-center gap-3">
        <button className="bg-stone-800 text-white px-4 py-2 rounded-lg" onClick={onSave}>
          {t('save')}
        </button>
        <span className="text-xs text-stone-400">{t('personDetail.autoSaveHint')}</span>
      </div>
    </>
  );
}
