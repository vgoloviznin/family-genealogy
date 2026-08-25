import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const SCHEMA_VERSION = 3;

export const people = sqliteTable('people', {
  id: text('id').primaryKey(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  middleName: text('middle_name'),
  maidenName: text('maiden_name'),
  sex: text('sex').notNull().default('unknown'),
  isLiving: integer('is_living', { mode: 'boolean' }).notNull().default(true),
  notes: text('notes'),
  primaryPhotoId: text('primary_photo_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  createdByDeviceId: text('created_by_device_id'),
  updatedByDeviceId: text('updated_by_device_id'),
  updatedByLabel: text('updated_by_label')
});

export const families = sqliteTable('families', {
  id: text('id').primaryKey(),
  unionType: text('union_type').notNull().default('marriage'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  createdByDeviceId: text('created_by_device_id'),
  updatedByDeviceId: text('updated_by_device_id'),
  updatedByLabel: text('updated_by_label')
});

export const familyPartners = sqliteTable('family_partners', {
  id: text('id').primaryKey(),
  familyId: text('family_id').notNull(),
  personId: text('person_id').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at')
});

export const familyChildren = sqliteTable('family_children', {
  id: text('id').primaryKey(),
  familyId: text('family_id').notNull(),
  personId: text('person_id').notNull(),
  pedigree: text('pedigree').notNull().default('birth'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at')
});

export const places = sqliteTable('places', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at')
});

export const events = sqliteTable('events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  customLabel: text('custom_label'),
  personId: text('person_id'),
  familyId: text('family_id'),
  placeId: text('place_id'),
  description: text('description'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  dateYear: integer('date_year'),
  dateMonth: integer('date_month'),
  dateDay: integer('date_day'),
  dateHour: integer('date_hour'),
  dateMinute: integer('date_minute'),
  datePrecision: text('date_precision').notNull().default('unknown'),
  dateOriginalText: text('date_original_text'),
  dateSortKey: integer('date_sort_key'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  createdByDeviceId: text('created_by_device_id'),
  updatedByDeviceId: text('updated_by_device_id'),
  updatedByLabel: text('updated_by_label')
});

export const associations = sqliteTable('associations', {
  id: text('id').primaryKey(),
  fromPersonId: text('from_person_id').notNull(),
  toPersonId: text('to_person_id').notNull(),
  role: text('role').notNull(),
  customRole: text('custom_role'),
  eventId: text('event_id'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  createdByDeviceId: text('created_by_device_id'),
  updatedByDeviceId: text('updated_by_device_id'),
  updatedByLabel: text('updated_by_label')
});

export const mediaAssets = sqliteTable('media_assets', {
  id: text('id').primaryKey(),
  relativePath: text('relative_path').notNull(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  contentHash: text('content_hash').notNull(),
  fileSize: integer('file_size').notNull(),
  caption: text('caption'),
  description: text('description'),
  takenAt: text('taken_at'),
  thumbRelativePath: text('thumb_relative_path'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  createdByDeviceId: text('created_by_device_id'),
  updatedByDeviceId: text('updated_by_device_id'),
  updatedByLabel: text('updated_by_label')
});

export const mediaLinks = sqliteTable('media_links', {
  id: text('id').primaryKey(),
  mediaId: text('media_id').notNull(),
  personId: text('person_id'),
  eventId: text('event_id'),
  createdAt: text('created_at').notNull(),
  deletedAt: text('deleted_at')
});

export const sources = sqliteTable('sources', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  type: text('type').notNull().default('other'),
  author: text('author'),
  details: text('details'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  createdByDeviceId: text('created_by_device_id'),
  updatedByDeviceId: text('updated_by_device_id'),
  updatedByLabel: text('updated_by_label')
});

export const citations = sqliteTable('citations', {
  id: text('id').primaryKey(),
  sourceId: text('source_id').notNull(),
  personId: text('person_id'),
  eventId: text('event_id'),
  page: text('page'),
  excerpt: text('excerpt'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  createdByDeviceId: text('created_by_device_id'),
  updatedByDeviceId: text('updated_by_device_id'),
  updatedByLabel: text('updated_by_label')
});

export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull()
});
