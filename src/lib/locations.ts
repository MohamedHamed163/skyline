import type { Location, LocationName, Property, SubLocation } from "./types";

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

/**
 * Active locations, plus `keepId` even if hidden (so editing a property doesn't drop its location).
 * Their sub-locations are filtered the same way, keeping `keepSubId`.
 */
export function selectableLocations(locations: Location[], keepId?: string, keepSubId?: string | null) {
  return locations
    .filter((l) => !l.archived || l.id === keepId)
    .map((l) => ({ ...l, subLocations: l.subLocations.filter((s) => !s.archived || s.id === keepSubId) }));
}

// ---- Sub-locations (docs/sub-locations.md) ----

export const MAX_SUB_LOCATION_NAME = 60;

/** The form's "Other (type it)" choice in the sub-location picker. */
export const SUB_LOCATION_OTHER = "other";

/** "new-cairo" + "fifth-settlement" → "new-cairo--fifth-settlement". slugify never makes "--", so it splits back. */
export const subLocationId = (locationId: string, slug: string) => `${locationId}--${slug}`;

/** The location a sub-location id belongs to. */
export const subLocationParent = (id: string) => id.split("--")[0];

/** Display order: sort order, then English name. */
export const sortSubLocations = (subs: SubLocation[]) =>
  [...subs].sort((a, b) => a.sortOrder - b.sortOrder || a.nameEn.localeCompare(b.nameEn));

/** Typed sub-location text: single spaces, trimmed, capped. */
export const cleanTyped = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, MAX_SUB_LOCATION_NAME);

/** Typed values that only differ in case or spacing are the same place. */
export const typedKey = (s: string) => cleanTyped(s).toLocaleLowerCase();

/** Whether typed text is Arabic, so "Add to list" can prefill the right name field. */
export const isArabic = (s: string) => /[\u0600-\u06FF]/.test(s);

export type SubLocationChoice = { subLocation: string | null; subLocationCustom: string };

/**
 * Reads the form's sub-location for a property in `place`. `picked` is a sub-location id, "other" or
 * ""; `typed` is the "Other" text. Typed text that matches a listed name (either language, any case)
 * becomes that sub-location. Returns null when the picked one isn't in this location. Hidden ones are
 * accepted: the forms only offer them to properties that already have them.
 */
export function readSubLocation(place: Location, picked: string, typed: string): SubLocationChoice | null {
  if (picked && picked !== SUB_LOCATION_OTHER) {
    return place.subLocations.some((s) => s.id === picked) ? { subLocation: picked, subLocationCustom: "" } : null;
  }
  const text = cleanTyped(typed);
  if (!text) return { subLocation: null, subLocationCustom: "" };
  const match = place.subLocations.find((s) => same(s.nameEn, text) || same(s.nameAr, text));
  return match ? { subLocation: match.id, subLocationCustom: "" } : { subLocation: null, subLocationCustom: text };
}

/** Like validateLocation, but names only have to be unique inside the location (`siblings`). */
export function validateSubLocation(input: LocationInput, siblings: SubLocation[], exceptId?: string): LocationError | null {
  if (!input.nameEn || !input.nameAr) return "missing";
  const clash = siblings.some((s) => s.id !== exceptId && (same(s.nameEn, input.nameEn) || same(s.nameAr, input.nameAr)));
  return clash ? "duplicate" : null;
}

type PlaceFields = Pick<Property, "compound" | "locationName" | "subLocationName" | "subLocationCustom">;

/** The sub-location's name in the current language, the typed one, or "". */
export function subLocationLabel(t: { locale: string }, p: Pick<PlaceFields, "subLocationName" | "subLocationCustom">) {
  // `??`: properties cached before sub-locations existed have neither field (docs/caching.md).
  return p.subLocationName ? localName(t, p.subLocationName) : (p.subLocationCustom ?? "");
}

/**
 * "Compound, Sub-location, Location", skipping empty parts and a sub-location that repeats the
 * compound (North Coast compounds such as Marassi are also sub-locations).
 */
export function placeParts(t: { locale: string }, p: PlaceFields) {
  const compound = p.compound.trim();
  const sub = subLocationLabel(t, p);
  const repeats = p.subLocationName ? [p.subLocationName.en, p.subLocationName.ar].some((n) => same(n, compound)) : same(sub, compound);
  return [compound, repeats ? "" : sub, localName(t, p.locationName)].filter(Boolean);
}

export type CustomSubLocation = { locationId: string; text: string; count: number };

/**
 * Typed sub-locations for the admin to add to the list or match, grouped per location regardless of
 * case and spacing (shown as first typed). Most used first.
 */
export function customSubLocations(properties: Pick<Property, "location" | "subLocationCustom">[]): CustomSubLocation[] {
  const groups = new Map<string, CustomSubLocation>();
  for (const p of properties) {
    if (!p.subLocationCustom) continue;
    const key = `${p.location}\n${typedKey(p.subLocationCustom)}`;
    const g = groups.get(key) ?? { locationId: p.location, text: cleanTyped(p.subLocationCustom), count: 0 };
    g.count++;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));
}
