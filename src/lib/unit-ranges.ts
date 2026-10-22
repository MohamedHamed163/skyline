import type { Property } from "./types";

// Unit ranges on Primary listings (docs/unit-ranges.md). A Primary listing is a developer's project
// with many units, so area, bedrooms, bathrooms, floor and price are given "from … to …". The plain
// fields hold the "from" values and the *Max fields the "to" values; a null "to" means every unit has
// the same value. Pure, so it can be unit tested without the database.

export const RANGE_KEYS = ["area", "bedrooms", "bathrooms", "floor", "price"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

/** The field holding each range's "to" value, also the form field's name. */
export const MAX_KEYS = {
  area: "areaMax",
  bedrooms: "bedroomsMax",
  bathrooms: "bathroomsMax",
  floor: "floorMax",
  price: "priceMax",
} as const satisfies Record<RangeKey, keyof Property>;

export type UnitRanges = Pick<Property, (typeof MAX_KEYS)[RangeKey]>;

/** Every "to" value empty: what Resale listings and rentals always have. */
export const NO_RANGES: UnitRanges = { areaMax: null, bedroomsMax: null, bathroomsMax: null, floorMax: null, priceMax: null };

/** Whether a listing describes its units as ranges: Primary listings for sale. */
export const hasUnitRanges = (p: Pick<Property, "listingType" | "purpose">) => p.purpose === "sale" && p.listingType === "primary";

type Ranged = Pick<Property, RangeKey> & Partial<UnitRanges>;

/**
 * The top of a range: its "to" value, or the "from" value when there is none. Missing keys (a
 * property cached before ranges existed, docs/caching.md) read as no range.
 */
export function upper<K extends RangeKey>(p: Ranged, key: K): Property[K] {
  return (p[MAX_KEYS[key]] ?? p[key]) as Property[K];
}

/** Whether the listing's units differ in this field, i.e. it shows a "from – to" range. */
export const isRange = (p: Ranged, key: RangeKey) => p[key] != null && upper(p, key) !== p[key];

/** "3 – 5" for a range, "3" for a single value. `show` formats each end. */
export function rangeText(min: number, max: number | null | undefined, show: (n: number) => string = String) {
  return max != null && max !== min ? `${show(min)} – ${show(max)}` : show(min);
}

export type RangeError = "toTooSmall" | "noFrom";

/**
 * Checks a range's "to" against its "from" (both already within the field's limits). null when it
 * is fine: an empty "to", or one at least the "from". A "to" without a "from" (an empty floor) is
 * an error, since the range would have no start.
 */
export function checkRange(from: number | null, to: number | null): RangeError | null {
  if (to === null) return null;
  if (from === null) return "noFrom";
  return to < from ? "toTooSmall" : null;
}

/** The "to" value to store: none when it equals the "from", so a single value stays single. */
export const storedMax = (from: number | null, to: number | null) => (to === null || to === from ? null : to);
