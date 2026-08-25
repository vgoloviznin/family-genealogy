import { v7 as uuidv7 } from 'uuid';

export function newId(): string {
  return uuidv7();
}

export function nowIso(): string {
  return new Date().toISOString();
}
