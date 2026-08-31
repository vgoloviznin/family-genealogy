import type { PersonDetail, UpdatePersonInput, UpsertEventInput, LifeEvent } from '@shared/types';
import { emptyDate } from '../../lib/labels';
import { formatCoordinates } from '@shared/coordinates';

export function buildFormFromPerson(person: PersonDetail) {
  return {
    firstName: person.firstName,
    lastName: person.lastName,
    middleName: person.middleName ?? '',
    maidenName: person.maidenName ?? '',
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
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    middleName: p.middleName ?? '',
    maidenName: p.maidenName ?? '',
    sex: p.sex,
    isLiving: p.isLiving,
    notes: p.notes ?? '',
    birth: {
      placeName: p.birthEvent?.placeName ?? '',
      date: p.birthEvent?.date ?? emptyDate(),
      description: p.birthEvent?.description ?? ''
    },
    death: p.isLiving
      ? null
      : {
          placeName: p.deathEvent?.placeName ?? '',
          date: p.deathEvent?.date ?? emptyDate(),
          description: p.deathEvent?.description ?? ''
        },
    burial: p.isLiving
      ? null
      : {
          placeName: p.burialEvent?.placeName ?? '',
          latitude: p.burialEvent?.latitude ?? null,
          longitude: p.burialEvent?.longitude ?? null,
          date: p.burialEvent?.date ?? emptyDate(),
          description: p.burialEvent?.description ?? ''
        }
  };
}

export function snapshotEvent(ev: LifeEvent): UpsertEventInput & { id: string } {
  return {
    id: ev.id,
    type: ev.type,
    customLabel: ev.customLabel ?? undefined,
    personId: ev.personId ?? undefined,
    familyId: ev.familyId ?? undefined,
    placeName: ev.placeName ?? '',
    description: ev.description ?? '',
    latitude: ev.latitude ?? null,
    longitude: ev.longitude ?? null,
    date: ev.date
  };
}
