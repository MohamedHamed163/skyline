import type { Property } from "./types";

// Rental codes are typed by the admin when they add a rental (docs/rental-codes.md). Sale codes
// (SKY-PRM-…, SKY-RES-…) are still issued from a sequence when the listing is first published.

/** Longest code the admin can type, in characters. */
export const MAX_CODE_LENGTH = 10;

/**
 * Letters in any script (English or Arabic) and digits (0-9 or ٠-٩) in groups joined by single
 * dashes, e.g. A101, VILLA-12 or شاليه-٥. Codes end up in the property's web address
 * (/properties/[code]), so spaces and symbols aren't allowed. Also the form field's `pattern`, which
 * the browser anchors at both ends and runs with the `v` flag.
 */
export const CODE_PATTERN = "[\\p{L}\\p{Nd}]+(-[\\p{L}\\p{Nd}]+)*";

const CODE_RE = new RegExp(`^(?:${CODE_PATTERN})$`, "u");

/**
 * The code as stored: trimmed, in capitals (the property page looks codes up in capitals; Arabic has
 * no capitals and is kept as typed) and in Unicode NFC, so the same Arabic code typed on different
 * keyboards is stored the same way.
 */
export const normalizeCode = (raw: string) => raw.trim().normalize("NFC").toUpperCase();

/** Whether a normalized code can be saved. Counts characters, not UTF-16 units. */
export const validCode = (code: string) => [...code].length <= MAX_CODE_LENGTH && CODE_RE.test(code);

/**
 * The code to look up from the `[code]` segment of /properties/[code]. An Arabic code may arrive
 * still percent-encoded (%D8%B4…), so it is decoded when it can be; a code never contains `%`.
 */
export function codeFromParam(param: string) {
  let code = param;
  if (code.includes("%")) {
    try {
      code = decodeURIComponent(code);
    } catch {
      // Not valid percent-encoding: look it up as it is (it won't match a code).
    }
  }
  return normalizeCode(code);
}

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
