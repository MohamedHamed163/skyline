// Tags on the cross-request data cache (store.ts) and how long public data may be served
// before it is refetched. See docs/caching.md.

export const CACHE_TAGS = {
  /** Anything a public page shows about a property. */
  properties: "properties",
  /** Location names and covers (also joined into every property). */
  locations: "locations",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

/**
 * Seconds before cached public data is refetched even if nothing invalidated it. Every
 * change made through the app invalidates its tag immediately; this only bounds staleness
 * for changes made around the app (SQL console, db:setup).
 */
export const PUBLIC_DATA_TTL = 300;
