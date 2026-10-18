# Skyline

Property management and listing platform for an Egyptian real-estate company, built with
Next.js (App Router) and Tailwind CSS.

## Workflow

Broker / owner creates an account (or signs in) at `/submit`, picks Primary or Resale and submits a
property → status **Pending Approval** → admin reviews in `/admin` → on approval the property gets a permanent code
(`SKY-PRM-0001` / `SKY-RES-0001`) and is published → customers browse `/properties` and request
more information → a lead is created with the property code → admin calls / WhatsApps the
customer and tracks the lead → the property is eventually reserved, sold or archived.

- Only **Published** properties are public. Seller details are never rendered on public pages.
- Brokers and owners see and edit their own listings at `/account`. Edits to a published listing
  wait for the admin's approval while the live listing stays up.
- Properties are never deleted; archive them instead.

## Run locally

```bash
npm install
npm run dev
```

Set `ADMIN_PASSWORD` (and optionally `SESSION_SECRET`) in `.env.local` to enable the admin dashboard.
Broker / owner accounts sign their session cookie with the same secret, so they need it too.

## Data

Postgres on Neon (`src/lib/store.ts`, schema in `src/lib/schema.sql`). Pull `DATABASE_URL` with
`vercel env pull`, then run `npm run db:setup` to create or migrate the tables. This is safe to re-run,
and it loads the sample data from `src/lib/seed.ts` only into an empty database. Photos and Primary
listing documents are stored in Vercel Blob (`BLOB_READ_WRITE_TOKEN`).

For load and pagination testing, `scripts/load-test-units.sql` adds 80 extra properties (ids
`load-001`…`load-080`) across every location and status, including rentals. Run it in any SQL client.
The file ends with the statements that remove the set again.

## Features

- [Site header](docs/site-header.md): which header items share the top row at each screen width, so the header never makes the page scroll sideways.
- [Home-page offers](docs/offers.md): the 1% Primary cashback and 0.5% Resale commission cards under the navbar, above the hero.
- [Home page sections](docs/homepage.md): the admin sets Primary/Resale and ticks "Show on the home page" to put a property first.
- [Listing types](docs/listing-types.md): Primary (formerly Premium) and Resale, and the home search tabs (Primary | Resale | Rent, no Buy tab).
- [Admin listing sections](docs/admin-listing-sections.md): Primary Listings and Resale Listings show sales of that type only, and Rentals shows rentals only.
- [Host accounts](docs/host-accounts.md): brokers and owners create a username and password the first time they list a property, then sign in to `/account` to list more, to see, count and edit their listings, and to change their password. The admin can give a host who forgot theirs a temporary one.
- [Pending Approvals: sales only](docs/pending-approvals.md): rentals never wait for approval. Pending Approvals counts and lists sales sent by brokers and owners only; a pending submission switched to Rent is published on save.
- [Host edits need approval](docs/host-edit-approval.md): a host's changes to a published listing are held; the admin compares old and new values (photos included) and approves or rejects them, while the live listing stays up.
- [Primary or Resale on /submit](docs/primary-documents.md): sellers pick the listing type first; Primary submissions can attach a brochure (PDF) and payment plan (PDF/Excel), uploaded straight to Vercel Blob and shown only to the admin.
- [Admin in Arabic and English](docs/admin-language.md): right-to-left and translation rules for the dashboard.
- [Locations](docs/locations.md): admin-managed locations (add, edit, hide/restore) at `/admin/locations`.
- [Property page](docs/property-page.md): the listing detail page, its linked location/compound details and the area map.
- [Project and developer descriptions](docs/developer-description.md): Primary listings have "About the project" and "About the developer" texts, both shown on the property page.
- [Floor number](docs/floor.md): optional floor (0 = ground, up to 45) on the property form, shown in the property page's key facts.
- [Lead statuses](docs/lead-statuses.md): leads are New, Contacted or Not Interested; the admin picks Contacted or Not Interested on each lead.
- [Forms](docs/forms.md): digits-only numeric fields with live range checks, title/description character counters, failed requests that never clear a form or crash the page, and the dropdown chevron.
- [Photo uploads](docs/photo-uploads.md): up to 8 photos per sale listing and 15 per rental, each up to 6 MB, with a friendly message naming any larger file.
- [Rental booking calendar](docs/rental-calendar.md): the admin blocks booked days on a rental's calendar; the property page shows customers which days are free.
- [Booking requests on WhatsApp](docs/booking-requests.md): customers pick check-in and check-out days on a rental's calendar, see the nights (and the total price on nightly rentals), and send Skyline (0109 990 0149) a ready-made WhatsApp message asking if the dates are free.
- [Rental codes](docs/rental-codes.md): the admin types each new rental's code (e.g. `VILLA12`) instead of getting an automatic `SKY-RNT-…` one; sale codes are still automatic.
- [Rental prices by date](docs/rental-pricing.md): weekend-night prices (Thursday and Friday) and special prices for seasons and holidays, set on a calendar in the rental form; customers see "From …" prices and each night's price.
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

Every request is rate limited per IP in `src/proxy.ts`, admin login attempts are capped at 5
per 15 minutes, and document uploads at 10 per 10 minutes. Navbar links ignore clicks on the page
that is already open, and they highlight the current page. See [docs/rate-limiting.md](docs/rate-limiting.md), which also covers the
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
