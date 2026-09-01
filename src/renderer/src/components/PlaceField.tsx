import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  label?: string;
  value: string;
  onChange: (v: string) => void;
}

export function PlaceField({ label, value, onChange }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [hints, setHints] = useState<Array<{ id: string; name: string }>>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void window.api.places.search(value).then(setHints);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = hints.filter((h) => h.name.toLowerCase() !== value.trim().toLowerCase());

  return (
    <div className="relative" ref={boxRef}>
      <label className="text-sm font-medium text-stone-700 block">
        {label ?? t('place')}
        <input
          className="w-full border border-stone-300 rounded-md px-2 py-1.5 mt-1 bg-stone-50"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
        />
      </label>
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-40 overflow-auto bg-white border rounded-lg shadow-md text-sm">
          {filtered.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                className="w-full text-left px-2 py-1.5 hover:bg-stone-50"
                onClick={() => {
                  onChange(h.name);
                  setOpen(false);
                }}
              >
                {h.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
