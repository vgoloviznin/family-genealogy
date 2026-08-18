import type { PartialDate, DatePrecision, Sex } from '@shared/types'

export function personLabel(p: { firstName: string; lastName: string; middleName?: string | null }): string {
  const label = [p.lastName, p.firstName, p.middleName].filter(Boolean).join(' ')
  return label || 'Новый человек'
}

export function formatDate(d: PartialDate): string {
  if (d.originalText) return d.originalText
  const parts: string[] = []
  if (d.precision === 'circa') parts.push('ок.')
  if (d.precision === 'before') parts.push('до')
  if (d.precision === 'after') parts.push('после')
  if (d.day) parts.push(String(d.day).padStart(2, '0'))
  if (d.month) parts.push(String(d.month).padStart(2, '0'))
  if (d.year) parts.push(String(d.year))
  return parts.join('.') || '—'
}

export const EVENT_TYPE_LABELS: Record<string, string> = {
  birth: 'Рождение',
  baptism: 'Крещение',
  death: 'Смерть',
  burial: 'Погребение',
  cremation: 'Кремация',
  adoption: 'Усыновление',
  education: 'Образование',
  occupation: 'Профессия',
  residence: 'Проживание',
  emigration: 'Эмиграция',
  immigration: 'Иммиграция',
  census: 'Перепись',
  military: 'Военная служба',
  retirement: 'Пенсия',
  will: 'Завещание',
  engagement: 'Помолвка',
  marriage: 'Брак',
  divorce: 'Развод',
  cohabitation: 'Совместное проживание',
  custom: 'Другое'
}

export const ASSOCIATION_LABELS: Record<string, string> = {
  godparent: 'Крёстный',
  witness: 'Свидетель',
  clergy: 'Священник',
  officiator: 'Совершавший обряд',
  friend: 'Друг',
  neighbor: 'Сосед',
  guardian: 'Опекун',
  executor: 'Исполнитель завещания',
  other: 'Другое'
}

export const PEDIGREE_LABELS: Record<string, string> = {
  birth: 'Биологический',
  adopted: 'Усыновлённый',
  step: 'Отчим/мачеха',
  foster: 'Опека'
}

export const SEX_LABELS: Record<string, string> = {
  male: 'Мужской',
  female: 'Женский',
  other: 'Другое',
  unknown: 'Неизвестно'
}

export const UNION_TYPE_LABELS: Record<string, string> = {
  marriage: 'Брак',
  partnership: 'Союз'
}

export function spouseLabel(sex?: Sex | null): string {
  if (sex === 'female') return 'Супруга'
  if (sex === 'male') return 'Супруг'
  return 'Супруг(а)'
}

export function siblingLabel(sex?: Sex | null): string {
  if (sex === 'female') return 'Сестра'
  if (sex === 'male') return 'Брат'
  return 'Брат/сестра'
}

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  book: 'Книга',
  archive: 'Архив',
  document: 'Документ',
  oral: 'Устный рассказ',
  website: 'Сайт',
  photo: 'Фото',
  other: 'Другое'
}

export function formatLifeSpan(p: {
  isLiving: boolean
  birthYear?: number | null
  deathYear?: number | null
}): string {
  if (p.birthYear && p.deathYear) return `${p.birthYear}–${p.deathYear}`
  if (p.birthYear && p.isLiving) return `р. ${p.birthYear}`
  if (p.birthYear) return `р. ${p.birthYear} – †`
  if (p.deathYear) return `† ${p.deathYear}`
  return p.isLiving ? 'жив' : 'умер(ла)'
}

/** События, неуместные для живого человека */
export const DEATH_RELATED_EVENTS = new Set(['death', 'burial', 'cremation'])

export const ADDABLE_EVENT_TYPES = Object.entries(EVENT_TYPE_LABELS).filter(
  ([code]) => !['birth', 'death'].includes(code)
)

export const emptyDate = (): PartialDate => ({
  precision: 'unknown' as DatePrecision,
  year: null,
  month: null,
  day: null,
  hour: null,
  minute: null,
  originalText: null,
  sortKey: null
})
