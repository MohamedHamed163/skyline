# Skyline

Property management and listing platform for an Egyptian real-estate company, built with
Next.js (App Router) and Tailwind CSS.

## Workflow

Broker / owner submits a property at `/submit` → status **Pending Approval** → admin reviews in
`/admin` → on approval the property gets a permanent code (`SKY-PRM-0001` / `SKY-RES-0001`) and
is published → customers browse `/properties` and request more information → a lead is created
with the property code → admin calls / WhatsApps the customer and tracks the lead → the property
is eventually reserved, sold or archived.

- Only **Published** properties are public. Seller details are never rendered on public pages.
- Properties are never deleted; archive them instead.

## Run locally

```bash
npm install
npm run dev
```

Set `ADMIN_PASSWORD` (and optionally `SESSION_SECRET`) in `.env.local` to enable the admin dashboard.

## Data

Postgres on Neon (`src/lib/store.ts`, schema in `src/lib/schema.sql`). Pull `DATABASE_URL` with
`vercel env pull`, then run `npm run db:setup` to create or migrate the tables. This is safe to re-run,
and it loads the sample data from `src/lib/seed.ts` only into an empty database. Photos are stored in
Vercel Blob (`BLOB_READ_WRITE_TOKEN`).

For load and pagination testing, `scripts/load-test-units.sql` adds 80 extra properties (ids
`load-001`…`load-080`) across every location and status, including rentals. Run it in any SQL client.
The file ends with the statements that remove the set again.

## Features

- [Locations](docs/locations.md): admin-managed locations (add, edit, hide/restore) at `/admin/locations`.
- [Property page](docs/property-page.md): the listing detail page, its linked location/compound details and the area map.
- [Sorting](docs/sorting.md): the "Sort by" dropdown on `/properties` applies on change, with a loading state.

## Caching

Public pages read their data (published properties, locations) from a cache. The database is
queried once, not on every page view, and admin changes expire the cache immediately. See
[docs/caching.md](docs/caching.md).

## Tests

```bash
npm test            # run once
npm run test:watch  # re-run on change
```

Unit tests use [Vitest](https://vitest.dev) and live next to the code (`src/**/*.test.ts`). Server
actions are tested with the store, auth and Next.js modules mocked, so no database is needed. Test
data builders are in `src/test/fixtures.ts`.

## Rate limiting

Every request is rate limited per IP in `src/proxy.ts`, and admin login attempts are capped at 5
per 15 minutes. Navbar links ignore clicks on the page that is already open, and they highlight
the current page. See [docs/rate-limiting.md](docs/rate-limiting.md), which also covers the
recommended Vercel Firewall rule.

## Tests

```bash
npm test
```

## Domains

The public website and the admin dashboard are one deployment served on two domains
(`src/proxy.ts`). Set these on Vercel:

- `ADMIN_HOST` — the admin domain (e.g. `skyline-admin-panel.vercel.app`). Only `/admin` is served
  there, and `/admin` returns 404 on every other domain.
- `PUBLIC_SITE_URL` — the public site URL, used for "View public page" links in the dashboard.

Leave both unset locally: `localhost:3000` serves the site and `/admin` together.
