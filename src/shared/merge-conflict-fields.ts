import type { MergeableTable, MergeConflictField, MergeRowRecord } from './merge-types';
import { MERGEABLE_COLUMNS } from './merge-types';

/** Russian labels for mergeable columns shown in conflict UI. */
export const MERGE_COLUMN_LABELS: Record<string, string> = {
  name: 'Название',
  normalized_name: 'Нормализованное название',
  deleted_at: 'Удалено',
  first_name: 'Имя',
  last_name: 'Фамилия',
  middle_name: 'Отчество',
  maiden_name: 'Девичья фамилия',
  sex: 'Пол',
  is_living: 'Жив',
  notes: 'Заметки',
  primary_photo_id: 'Основное фото',
  union_type: 'Тип союза',
  family_id: 'Семья',
  person_id: 'Человек',
  sort_order: 'Порядок',
  pedigree: 'Происхождение',
  type: 'Тип',
  custom_label: 'Своя метка',
  place_id: 'Место',
  description: 'Описание',
  latitude: 'Широта',
  longitude: 'Долгота',
  date_year: 'Год',
  date_month: 'Месяц',
  date_day: 'День',
  date_hour: 'Час',
  date_minute: 'Минута',
  date_precision: 'Точность даты',
  date_original_text: 'Исходный текст даты',
  date_sort_key: 'Ключ сортировки даты',
  from_person_id: 'От человека',
  to_person_id: 'К человеку',
  role: 'Роль',
  custom_role: 'Своя роль',
  event_id: 'Событие',
  title: 'Заголовок',
  author: 'Автор',
  details: 'Детали',
  source_id: 'Источник',
  page: 'Страница',
  excerpt: 'Выдержка',
  relative_path: 'Путь',
  file_name: 'Имя файла',
  mime_type: 'MIME-тип',
  content_hash: 'Хеш',
  file_size: 'Размер',
  caption: 'Подпись',
  taken_at: 'Снято',
  thumb_relative_path: 'Превью',
  media_id: 'Медиа'
};

export function getColumnLabel(column: string): string {
  return MERGE_COLUMN_LABELS[column] ?? column;
}

function asString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

/** Human-readable row title for conflict list. */
export function getConflictRowLabel(table: MergeableTable, row: MergeRowRecord): string {
  if (table === 'people') {
    const last = asString(row.last_name);
    const first = asString(row.first_name);
    const name = [last, first].filter(Boolean).join(' ').trim();
    if (name) {
      return name;
    }
  }
  const id = typeof row.id === 'string' ? row.id : String(row.id ?? '');
  return `${table}:${id}`;
}

function normalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  return value;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalizeValue(a)) === JSON.stringify(normalizeValue(b));
}

/** Diff of MERGEABLE_COLUMNS that differ between local and remote. */
export function getConflictFieldDiffs(table: MergeableTable, local: MergeRowRecord, remote: MergeRowRecord): MergeConflictField[] {
  const fields: MergeConflictField[] = [];
  for (const column of MERGEABLE_COLUMNS[table]) {
    const localValue = local[column];
    const remoteValue = remote[column];
    if (!valuesEqual(localValue, remoteValue)) {
      fields.push({ column, local: localValue, remote: remoteValue });
    }
  }
  return fields;
}
