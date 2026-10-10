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

`src/lib/store.ts` is a starter in-memory store (saved under `.data/` locally, seeded from
`src/lib/seed.ts`). On Vercel it resets when the server instance restarts — replace it with a real
database and file storage before going live.

## Domains

The public website and the admin dashboard are one deployment served on two domains
(`src/proxy.ts`). Set these on Vercel:

- `ADMIN_HOST` — the admin domain (e.g. `skyline-admin-panel.vercel.app`). Only `/admin` is served
  there, and `/admin` returns 404 on every other domain.
- `PUBLIC_SITE_URL` — the public site URL, used for "View public page" links in the dashboard.

Leave both unset locally: `localhost:3000` serves the site and `/admin` together.
