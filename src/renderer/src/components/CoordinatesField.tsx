import { useTranslation } from 'react-i18next';
import { mapLink, parseCoordinates } from '@shared/coordinates';

interface Props {
  label?: string;
  value: string;
  onChange: (v: string) => void;
}

export function CoordinatesField({ label, value, onChange }: Props) {
  const { t } = useTranslation();
  const parsed = parseCoordinates(value);
  const invalid = value.trim().length > 0 && !parsed;

  return (
    <div>
      <label className="text-sm font-medium text-stone-700 block">
        {label ?? t('coordinates')}
        <input
          className={`w-full border rounded-md px-2 py-1.5 mt-1 bg-stone-50 ${invalid ? 'border-red-400' : 'border-stone-300'}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="55.7558, 37.6173"
          autoComplete="off"
        />
      </label>
      {invalid ? (
        <p className="text-xs text-red-700 mt-1">{t('personDetail.coordinatesInvalid')}</p>
      ) : parsed ? (
        <a className="text-xs text-stone-600 underline mt-1 inline-block" href={mapLink(parsed)} target="_blank" rel="noreferrer">
          {t('personDetail.openOnMap')}
        </a>
      ) : (
        <p className="text-xs text-stone-400 mt-1">{t('personDetail.coordinatesPasteHint')}</p>
      )}
    </div>
  );
}
