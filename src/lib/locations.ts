import type { Location, LocationName } from "./types";

// Pure location helpers (no DB access), shared by the server actions, pages and tests.

/** Shown on the home page for a location without an uploaded cover. */
export const DEFAULT_LOCATION_COVER = "/listings/villa-1.jpg";

export const MAX_LOCATION_NAME = 60;

/** The location name in the current language. */
export const localName = (t: { locale: string }, name: LocationName) => (t.locale === "ar" ? name.ar : name.en) || name.en;

export const toLocationName = (l: Pick<Location, "nameEn" | "nameAr">): LocationName => ({ en: l.nameEn, ar: l.nameAr });

/** A Location's name in the current language. */
export const locationLabel = (t: { locale: string }, l: Pick<Location, "nameEn" | "nameAr">) => localName(t, toLocationName(l));

/** "New Cairo" → "new-cairo". Non-Latin names fall back to "location". */
export function slugify(name: string) {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");
  return slug || "location";
}

/** First free id among slug, slug-2, slug-3, … */
export function uniqueSlug(base: string, taken: Iterable<string>) {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export type LocationInput = { nameEn: string; nameAr: string };

export type LocationError = "missing" | "duplicate";

const same = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/**
 * Validates admin input against the existing locations (hidden ones included, so a hidden location
 * is restored rather than duplicated). `exceptId` skips the location being edited.
 */
export function validateLocation(input: LocationInput, existing: Location[], exceptId?: string): LocationError | null {
  if (!input.nameEn || !input.nameAr) return "missing";
  const clash = existing.some((l) => l.id !== exceptId && (same(l.nameEn, input.nameEn) || same(l.nameAr, input.nameAr)));
  return clash ? "duplicate" : null;
}

/** Active locations, plus `keepId` even if hidden (so editing a property doesn't drop its location). */
export function selectableLocations(locations: Location[], keepId?: string) {
  return locations.filter((l) => !l.archived || l.id === keepId);
}
