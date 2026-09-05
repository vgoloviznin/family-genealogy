/** True if at least one of first/last name parts is non-empty after trim. */
export function hasRequiredNamePart(firstName?: string | null, lastName?: string | null): boolean {
  return Boolean(firstName?.trim() || lastName?.trim());
}
