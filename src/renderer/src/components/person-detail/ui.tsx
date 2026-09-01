import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Sex } from '@shared/types';
import { personLabel, formatLifeSpan } from '../../lib/labels';

export function Field({
  label,
  value,
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-sm font-medium text-stone-700 block">
      {label}
      <input
        className="w-full border border-stone-300 rounded-md px-2 py-1.5 mt-1 bg-stone-50 font-normal text-stone-900"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function ActionBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      className="text-sm border border-stone-300 rounded-lg px-3 py-1 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed"
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

export function GhostBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="text-xs border border-stone-300 text-stone-700 rounded-md px-2 py-0.5 hover:bg-white shrink-0" onClick={onClick}>
      {label}
    </button>
  );
}

export function DangerBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="text-xs border border-red-300 text-red-700 rounded-md px-2 py-0.5 hover:bg-red-50 shrink-0" onClick={onClick}>
      {label}
    </button>
  );
}

export function RelRow({
  role,
  person,
  onOpen,
  extra,
  onUnlink
}: {
  role?: string;
  person: {
    firstName: string;
    lastName: string;
    middleName?: string | null;
    isLiving: boolean;
    birthYear?: number | null;
    deathYear?: number | null;
    sex?: Sex;
  };
  onOpen: () => void;
  extra?: ReactNode;
  onUnlink: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 flex-wrap rounded-lg border border-stone-300 bg-stone-50 px-2.5 py-1.5">
      {role && <span className="text-xs font-medium text-stone-500 w-[4.75rem] shrink-0">{role}</span>}
      <button type="button" className="font-semibold text-stone-900 hover:underline text-left min-w-0 truncate" onClick={onOpen}>
        {personLabel(person)}
      </button>
      <span className="text-xs text-stone-600 shrink-0">{formatLifeSpan(person)}</span>
      {extra}
      <span className="ml-auto">
        <DangerBtn label={t('personDetail.unlink')} onClick={onUnlink} />
      </span>
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-stone-400 text-center py-6">{text}</p>;
}
