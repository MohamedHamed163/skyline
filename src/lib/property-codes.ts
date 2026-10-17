import type { Property } from "./types";

// Rental codes are typed by the admin when they add a rental (docs/rental-codes.md). Sale codes
// (SKY-PRM-…, SKY-RES-…) are still issued from a sequence when the listing is first published.

/** Longest code the admin can type. */
export const MAX_CODE_LENGTH = 30;

/**
 * English letters and digits in groups joined by single dashes, e.g. SKY-RNT-0101. Codes end up in
 * the property's web address (/properties/[code]), so nothing else is allowed. Also the form field's
 * `pattern`, which the browser anchors at both ends.
 */
export const CODE_PATTERN = "[A-Za-z0-9]+(-[A-Za-z0-9]+)*";

const CODE_RE = new RegExp(`^(?:${CODE_PATTERN})$`);

/** The code as stored: trimmed and in capitals, since the property page looks codes up in capitals. */
export const normalizeCode = (raw: string) => raw.trim().toUpperCase();

/** Whether a normalized code can be saved. */
export const validCode = (code: string) => code.length <= MAX_CODE_LENGTH && CODE_RE.test(code);

/**
 * Whether a database error is the unique `properties.code` constraint, i.e. the code is already
 * used by another property. postgres.js reports it as SQLSTATE 23505 with the constraint's name.
 */
export function isCodeConflict(err: unknown) {
  const e = err as { code?: unknown; constraint_name?: unknown } | null;
  return e?.code === "23505" && e.constraint_name === "properties_code_key";
}

/**
 * Ids of the rentals, for the "Rental requests" filter on /admin/leads. Leads are matched through
 * their property, since rental codes no longer share the SKY-RNT- prefix.
 */
export const rentalIds = (properties: Pick<Property, "id" | "purpose">[]) =>
  new Set(properties.filter((p) => p.purpose === "rent").map((p) => p.id));
