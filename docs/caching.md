# Caching

Public page views are served from a data cache instead of querying Postgres every time. Floods of
traffic (see also [rate-limiting.md](rate-limiting.md)) mostly cost CPU, not database
connections. The pool holds only 5 connections per instance (`src/lib/db.ts`).

## What is cached

| Read (`src/lib/store.ts`) | Used by | Tags |
| --- | --- | --- |
| `getPublishedProperties()` | home, `/properties` (all filters, sorts, pages), `/properties/[code]`, `/projects`, `/projects/[slug]` | `properties`, `locations` |
| `getLocations()` / `getActiveLocations()` | `/properties` filters, search bar, home tiles, `/submit`, admin locations | `locations` |

- **One list feeds the whole public site.** Search, filters, sorting and pagination run in memory
  over the cached list (`src/lib/search.ts`), so `?type=villa&page=3` adds no query.
- **Fields added later are optional in old entries.** A list cached before a field existed (booked
  days, weekend and special prices) has no key for it until it is refetched, so readers treat a
  missing key as empty ([rental-calendar.md](rental-calendar.md), [rental-pricing.md](rental-pricing.md)).
- **The property page looks codes up in the cached list too** (`getPublishedProperty`). Requests
  for made-up codes like `/properties/SKY-XXX-9999` return 404 without touching the database.
- The cache is Next.js's data cache (`unstable_cache`). On Vercel it is shared by all instances
  and survives deploys of the same build. Self-hosted, it lives on each server's disk.

## What is not cached

- **Admin lists** (`getProperties`, `getLeads`) and single-record reads used by admin and actions
  (`getProperty`). Admin users always see live data.
- **Leads and pending submissions.** Public pages never show them, so they don't touch the cache.
- **The rendered HTML.** Pages read the `lang` cookie, so they render per request. Rendering from
  cached data is cheap; it's the database work that is skipped.

## Freshness

Every admin change made through the app **expires the matching tag immediately** (`updateTag` in
`src/lib/actions.ts`). The next page view refetches the data, so changes show up straight away:

| Action | Expires |
| --- | --- |
| `setPropertyStatus` (approve, reject, sold, archive, …), `requestChanges`, `updateProperty`, `createPropertyAdmin`, `setBookedDays` ([rental-calendar.md](rental-calendar.md)) | `properties` |
| `createLocation`, `updateLocation`, `setLocationArchived` | `locations` (property data too, since it carries location names) |

As a safety net, cached data is also refetched after **5 minutes** (`PUBLIC_DATA_TTL` in
`src/lib/cache-tags.ts`). That bounds staleness for changes made around the app, such as edits in
the Neon SQL console or `npm run db:setup`.

### Adding a new write

If a new server action changes something a public page shows, call
`updateTag(CACHE_TAGS.<tag>)` after the write, and add a case to
`src/lib/cache-invalidation.test.ts`. If a new public read is added to `store.ts`, wrap it the same
way as `getPublishedProperties` and tag it.

## Don't use `export const dynamic = "force-dynamic"` on public pages

`force-dynamic` also switches off the data cache for the whole route (`fetchCache =
"force-no-store"`), so every request would hit the database again. The public pages are already
rendered per request because they read the language cookie, so the flag isn't needed.

## Limits and next steps

- **Entry size.** Vercel's data cache stores up to 2 MB per entry. The published list is about 2 KB
  per property, which is fine for roughly 800 properties. Past that, cache per page or per filter,
  or drop fields public pages don't use (seller details) from the cached list.
- **Full-page caching** (HTML served from the CDN) would need the language in the URL (`/en/…`,
  `/ar/…`) instead of a cookie.
- **`unstable_cache` and Cache Components.** Next.js 16 recommends replacing `unstable_cache` with the
  `"use cache"` directive, which requires turning on `cacheComponents`. That changes rendering
  app-wide: anything reading cookies must sit in a `<Suspense>` boundary. When that migration
  happens, each cached read becomes `"use cache"` + `cacheTag(...)` + `cacheLife(...)`, and
  the tags and `updateTag` calls stay as they are.

## Verifying locally

Caching is active with `next build && next start`. Run the server with
`NEXT_PRIVATE_DEBUG_CACHE=1` to log cache activity: repeated page views log `FileSystemCache: get`
and no new `set`, which means no new database query.

## Tests

- `src/lib/caching.test.ts`: which reads are cached, with which tags and TTL; code lookups reuse the cached list
- `src/lib/cache-invalidation.test.ts`: each admin write expires the right tag; lead and submission writes don't
