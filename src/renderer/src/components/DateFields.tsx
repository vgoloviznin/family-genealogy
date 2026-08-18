import type { PartialDate, DatePrecision } from '@shared/types'

interface Props {
  value: PartialDate
  onChange: (v: PartialDate) => void
  label?: string
}

const precisions: { value: DatePrecision; label: string }[] = [
  { value: 'unknown', label: 'Неизвестно' },
  { value: 'year', label: 'Только год' },
  { value: 'month', label: 'Год и месяц' },
  { value: 'exact', label: 'Точная дата' },
  { value: 'circa', label: 'Около' },
  { value: 'before', label: 'До' },
  { value: 'after', label: 'После' }
]

export function DateFields({ value, onChange, label }: Props) {
  return (
    <div className="space-y-2">
      {label && <div className="text-sm font-medium text-stone-600">{label}</div>}
      <select
        className="w-full border border-stone-300 rounded px-2 py-1 text-sm"
        value={value.precision}
        onChange={(e) => onChange({ ...value, precision: e.target.value as DatePrecision })}
      >
        {precisions.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      {value.precision !== 'unknown' && (
        <div className="grid grid-cols-3 gap-2">
          <input
            type="number"
            placeholder="День"
            className="border border-stone-300 rounded px-2 py-1 text-sm"
            value={value.day ?? ''}
            onChange={(e) => onChange({ ...value, day: e.target.value ? Number(e.target.value) : null })}
          />
          <input
            type="number"
            placeholder="Месяц"
            className="border border-stone-300 rounded px-2 py-1 text-sm"
            value={value.month ?? ''}
            onChange={(e) => onChange({ ...value, month: e.target.value ? Number(e.target.value) : null })}
          />
          <input
            type="number"
            placeholder="Год"
            className="border border-stone-300 rounded px-2 py-1 text-sm"
            value={value.year ?? ''}
            onChange={(e) => onChange({ ...value, year: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
      )}
      <input
        placeholder="Или текстом: ок. 1890"
        className="w-full border border-stone-300 rounded px-2 py-1 text-sm"
        value={value.originalText ?? ''}
        onChange={(e) => onChange({ ...value, originalText: e.target.value || null })}
      />
    </div>
  )
}
