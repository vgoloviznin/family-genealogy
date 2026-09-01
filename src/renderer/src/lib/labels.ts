import type { AppLocale, PartialDate, DatePrecision, Sex, UnionType } from '@shared/types';
import { formatPartialDate } from '@shared/format-partial-date';
import { normalizeUnionType } from '@shared/union-type';
import i18n from '../i18n';

export { normalizeUnionType };

export function personLabel(p: { firstName: string; lastName: string; middleName?: string | null }): string {
  const label = [p.lastName, p.firstName, p.middleName].filter(Boolean).join(' ');
  return label || i18n.t('enum.newPerson');
}

export function personShortLabel(p: { firstName: string; lastName: string; middleName?: string | null }): string {
  const last = p.lastName.trim();
  const initials = [p.firstName, p.middleName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .map((part) => `${part![0]}.`);
  const given = initials.join(' ');
  if (last && given) {
    return `${last} ${given}`;
  }
  if (last) {
    return last;
  }
  if (given) {
    return given;
  }
  return personLabel(p);
}

export function personInitials(p: { firstName: string; lastName: string }): string {
  const letters = [p.firstName?.trim()?.[0], p.lastName?.trim()?.[0]].filter(Boolean).join('');
  return letters.toUpperCase() || '?';
}

export function formatDate(d: PartialDate): string {
  return formatPartialDate(d, i18n.language as AppLocale);
}

export function eventTypeLabel(code: string): string {
  return i18n.t(`enum.eventType.${code}`, { defaultValue: code });
}

export function associationLabel(code: string): string {
  return i18n.t(`enum.association.${code}`, { defaultValue: code });
}

export function pedigreeLabel(code: string): string {
  return i18n.t(`enum.pedigree.${code}`, { defaultValue: code });
}

export function sexLabel(code: string): string {
  return i18n.t(`enum.sex.${code}`, { defaultValue: code });
}

export function sourceTypeLabel(code: string): string {
  return i18n.t(`enum.sourceType.${code}`, { defaultValue: code });
}

export function unionTypeLabel(code: string | null | undefined): string {
  return i18n.t(`enum.unionType.${normalizeUnionType(code)}`);
}

export function enumOptions(prefix: string, codes: string[]): [string, string][] {
  return codes.map((code) => [code, i18n.t(`${prefix}.${code}`, { defaultValue: code })]);
}

export const EVENT_TYPE_CODES = [
  'birth',
  'baptism',
  'death',
  'burial',
  'cremation',
  'adoption',
  'education',
  'occupation',
  'residence',
  'emigration',
  'immigration',
  'census',
  'military',
  'retirement',
  'will',
  'engagement',
  'marriage',
  'divorce',
  'cohabitation',
  'custom'
] as const;

export const ASSOCIATION_CODES = ['godparent', 'witness', 'clergy', 'officiator', 'friend', 'neighbor', 'guardian', 'executor', 'other'] as const;

export const PEDIGREE_CODES = ['birth', 'adopted', 'step', 'foster'] as const;

export const SEX_CODES = ['male', 'female', 'other', 'unknown'] as const;

export const SOURCE_TYPE_CODES = ['book', 'archive', 'document', 'oral', 'website', 'photo', 'other'] as const;

export const UNION_TYPE_CODES: UnionType[] = ['unknown', 'marriage', 'partnership'];

export function spouseLabel(sex?: Sex | null): string {
  if (sex === 'female') {
    return i18n.t('enum.spouse.female');
  }
  if (sex === 'male') {
    return i18n.t('enum.spouse.male');
  }
  return i18n.t('enum.spouse.other');
}

export function siblingLabel(sex?: Sex | null): string {
  if (sex === 'female') {
    return i18n.t('enum.sibling.female');
  }
  if (sex === 'male') {
    return i18n.t('enum.sibling.male');
  }
  return i18n.t('enum.sibling.other');
}

export function deceasedLabel(sex?: Sex | null): string {
  if (sex === 'male') {
    return i18n.t('enum.deceased.male');
  }
  if (sex === 'female') {
    return i18n.t('enum.deceased.female');
  }
  return i18n.t('enum.deceased.other');
}

export function formatLifeSpan(p: { isLiving: boolean; birthYear?: number | null; deathYear?: number | null; sex?: Sex | null }): string {
  if (p.birthYear && p.deathYear) {
    return `${p.birthYear}–${p.deathYear}`;
  }
  if (p.birthYear && p.isLiving) {
    return i18n.t('lifeSpan.born', { year: p.birthYear });
  }
  if (p.birthYear) {
    return i18n.t('lifeSpan.bornDeceased', { year: p.birthYear, deceased: deceasedLabel(p.sex) });
  }
  if (p.deathYear) {
    return i18n.t('lifeSpan.deceasedYear', { deceased: deceasedLabel(p.sex), year: p.deathYear });
  }
  return p.isLiving ? i18n.t('lifeSpan.living') : deceasedLabel(p.sex);
}

export const DEATH_RELATED_EVENTS = new Set(['death', 'burial', 'cremation']);

export const ADDABLE_EVENT_TYPE_CODES = EVENT_TYPE_CODES.filter((code) => !['birth', 'death', 'burial'].includes(code));

export const emptyDate = (): PartialDate => ({
  precision: 'unknown' as DatePrecision,
  year: null,
  month: null,
  day: null,
  hour: null,
  minute: null,
  originalText: null,
  sortKey: null
});

export function mergeColumnLabel(column: string): string {
  return i18n.t(`merge.column.${column}`, { defaultValue: column });
}
