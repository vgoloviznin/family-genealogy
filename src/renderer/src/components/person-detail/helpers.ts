import type { PersonDetail, UpdatePersonInput, UpsertEventInput, LifeEvent, PartialDate } from '@shared/types';
import { snapshotPersonDetail, snapshotLifeEvent } from '@shared/person-snapshot';
import { emptyDate } from '../../lib/labels';
import { formatCoordinates } from '@shared/coordinates';

export function buildFormFromPerson(person: PersonDetail) {
  return {
    firstName: person.firstName,
    lastName: person.lastName,
    middleName: person.middleName ?? '',
    maidenName: person.maidenName ?? '',
    firstNameEn: person.firstNameEn ?? '',
    lastNameEn: person.lastNameEn ?? '',
    middleNameEn: person.middleNameEn ?? '',
    maidenNameEn: person.maidenNameEn ?? '',
    sex: person.sex,
    isLiving: person.isLiving,
    notes: person.notes ?? '',
    birthDate: person.birthEvent?.date ?? emptyDate(),
    birthPlace: person.birthEvent?.placeName ?? '',
    deathDate: person.deathEvent?.date ?? emptyDate(),
    deathPlace: person.deathEvent?.placeName ?? '',
    burialPlace: person.burialEvent?.placeName ?? '',
    burialCoords: formatCoordinates(person.burialEvent?.latitude, person.burialEvent?.longitude)
  };
}

export type PersonFormState = ReturnType<typeof buildFormFromPerson>;

export function snapshotPerson(p: PersonDetail): UpdatePersonInput {
  return snapshotPersonDetail(p);
}

export function snapshotEvent(ev: LifeEvent): UpsertEventInput & { id: string } {
  return snapshotLifeEvent(ev);
}

function datesEqual(a: PartialDate, b: PartialDate): boolean {
  return (
    (a.year ?? null) === (b.year ?? null) &&
    (a.month ?? null) === (b.month ?? null) &&
    (a.day ?? null) === (b.day ?? null) &&
    (a.hour ?? null) === (b.hour ?? null) &&
    (a.minute ?? null) === (b.minute ?? null) &&
    a.precision === b.precision &&
    (a.originalText ?? '') === (b.originalText ?? '')
  );
}

export function isPersonFormDirty(a: PersonFormState, b: PersonFormState): boolean {
  return (
    a.firstName !== b.firstName ||
    a.lastName !== b.lastName ||
    a.middleName !== b.middleName ||
    a.maidenName !== b.maidenName ||
    a.firstNameEn !== b.firstNameEn ||
    a.lastNameEn !== b.lastNameEn ||
    a.middleNameEn !== b.middleNameEn ||
    a.maidenNameEn !== b.maidenNameEn ||
    a.sex !== b.sex ||
    a.isLiving !== b.isLiving ||
    a.notes !== b.notes ||
    a.birthPlace !== b.birthPlace ||
    a.deathPlace !== b.deathPlace ||
    a.burialPlace !== b.burialPlace ||
    a.burialCoords !== b.burialCoords ||
    !datesEqual(a.birthDate, b.birthDate) ||
    !datesEqual(a.deathDate, b.deathDate)
  );
}

/** Serialize form for last-saved comparison without relying on JSON key order for dirty checks. */
export function formSnapshotKey(form: PersonFormState): string {
  return [
    form.firstName,
    form.lastName,
    form.middleName,
    form.maidenName,
    form.firstNameEn,
    form.lastNameEn,
    form.middleNameEn,
    form.maidenNameEn,
    form.sex,
    form.isLiving ? '1' : '0',
    form.notes,
    form.birthPlace,
    form.deathPlace,
    form.burialPlace,
    form.burialCoords,
    form.birthDate.year ?? '',
    form.birthDate.month ?? '',
    form.birthDate.day ?? '',
    form.birthDate.precision,
    form.deathDate.year ?? '',
    form.deathDate.month ?? '',
    form.deathDate.day ?? '',
    form.deathDate.precision
  ].join('\u0001');
}
