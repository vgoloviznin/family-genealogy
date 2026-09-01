import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { PartialDate, DatePrecision } from '@shared/types';
import { datePartsVisibility, trimPartialDateForPrecision } from '@shared/partial-date';

interface Props {
  value: PartialDate;
  onChange: (v: PartialDate) => void;
  label?: string;
}

const PRECISION_CODES: DatePrecision[] = ['unknown', 'year', 'month', 'exact', 'circa', 'before', 'after'];

export function DateFields({ value, onChange, label }: Props) {
  const { t, i18n } = useTranslation();
  const parts = datePartsVisibility(value.precision);
  const showNumeric = parts.day || parts.month || parts.year;
  const colCount = [parts.day, parts.month, parts.year].filter(Boolean).length;

  const precisions = useMemo(() => PRECISION_CODES.map((code) => ({ value: code, label: t(`dateField.precision.${code}`) })), [t, i18n.language]);

  return (
    <div className="space-y-2">
      {label && <div className="text-sm font-medium text-stone-600">{label}</div>}
      <select
        className="w-full border border-stone-300 rounded px-2 py-1 text-sm"
        value={value.precision}
        onChange={(e) => onChange(trimPartialDateForPrecision({ ...value, precision: e.target.value as DatePrecision }))}
      >
        {precisions.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      {showNumeric && (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}>
          {parts.day && (
            <input
              type="number"
              placeholder={t('dateField.dayPlaceholder')}
              className="border border-stone-300 rounded px-2 py-1 text-sm"
              value={value.day ?? ''}
              onChange={(e) => onChange({ ...value, day: e.target.value ? Number(e.target.value) : null })}
            />
          )}
          {parts.month && (
            <input
              type="number"
              placeholder={t('dateField.monthPlaceholder')}
              className="border border-stone-300 rounded px-2 py-1 text-sm"
              value={value.month ?? ''}
              onChange={(e) => onChange({ ...value, month: e.target.value ? Number(e.target.value) : null })}
            />
          )}
          {parts.year && (
            <input
              type="number"
              placeholder={t('dateField.yearPlaceholder')}
              className="border border-stone-300 rounded px-2 py-1 text-sm"
              value={value.year ?? ''}
              onChange={(e) => onChange({ ...value, year: e.target.value ? Number(e.target.value) : null })}
            />
          )}
        </div>
      )}
      <input
        placeholder={t('dateField.orTextPlaceholder')}
        className="w-full border border-stone-300 rounded px-2 py-1 text-sm"
        value={value.originalText ?? ''}
        onChange={(e) => onChange({ ...value, originalText: e.target.value || null })}
      />
    </div>
  );
}
