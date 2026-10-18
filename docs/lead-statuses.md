# Lead statuses

## Purpose

Keep lead tracking simple: a lead is either still **New**, **Contacted**, or **Not Interested**.
The older steps (Interested, Viewing Scheduled, Negotiating, Closed) were removed.

## Admin behaviour

- Every request from the site arrives as **New**. New leads feed the "uncontacted" count on the
  dashboard and the badge in the admin menu.
- On each lead card (`/admin/leads`), the status dropdown offers only **Contacted** and
  **Not Interested**. A new lead shows "New" in the closed dropdown as a placeholder, but it isn't
  in the list, so a lead can't be moved back to New.
- Saving a new lead without picking a status saves the internal notes and keeps it New.
- The filter at the top of `/admin/leads` still lists all three statuses (with counts), so
  "New" can be used to find uncontacted leads.

## Data model

`leads.status` (text, default `'new'`) holds `new`, `contacted` or `not_interested`.
`src/lib/schema.sql` moves leads saved with a removed status (`interested`,
`viewing_scheduled`, `negotiating`, `closed`) to `contacted`; it's idempotent.

**Deploy order:** run `npm run db:setup` with (or right after) the deploy. Until it runs, leads
with a removed status show a blank status badge; saving them still works.

## Code map

- `src/lib/types.ts` — `LEAD_STATUSES` (all three) and `SETTABLE_LEAD_STATUSES` (the dropdown's two).
- `src/lib/leads.ts` — `leadPatch`: turns the submitted status and notes into the update; an
  unsettable or empty status keeps the current one.
- `src/lib/actions.ts` — `updateLead` server action.
- `src/lib/store.ts` — `updateLead` (`COALESCE` keeps the status when none is given).
- `src/components/admin-ui.tsx` — `LeadCard` dropdown and `LeadStatusBadge` colours.
- `src/lib/i18n/en.ts`, `ar.ts` — `leadStatus` labels.

## Tests

`src/lib/leads.test.ts` — the status lists, labels in both languages, and `leadPatch`.
