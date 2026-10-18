# Pending Approvals: sales only

**Pending Approvals** in the admin sidebar lists the listings brokers and owners send from `/submit`,
so the admin can review them before they go live. Rentals are never in it. Skyline lists rentals
itself, so they are published the moment they're saved.

## Admin behaviour

- **Sidebar count, dashboard "Pending" tile and `/admin/properties?status=pending`** count and list
  pending **sales** only. Choosing "Pending" in the status filter shows the same list.
- **Add rental** publishes the rental straight away with the code the admin typed (unchanged, see
  [rental-codes.md](rental-codes.md)).
- **A pending submission switched to Rent** on its edit page is published when saved and gets a
  `SKY-RNT-…` code, instead of staying pending. Pending sales are saved as before and keep waiting.
- Brokers and owners can't list rentals (`/submit` is sale-only), so nothing else creates a pending
  rental.

## Data model

No new columns. `src/lib/schema.sql` ends with an idempotent `UPDATE` that publishes any rental
still `pending` (previous status `pending`) and gives it a `SKY-RNT-…` code from
`property_code_rent` if it has none. It runs with `npm run db:setup`, after the sequence exists. The
load-test rental `load-042` in `scripts/load-test-units.sql` is now published with a code.

Deploy order: none. The new code already hides pending rentals before the `UPDATE` runs.

## Code map

| File | What it does |
| --- | --- |
| `src/lib/approvals.ts` | `awaitsApproval` (pending and a sale) and `publishesOnSave` (a pending listing saved as a rental). Pure, no DB. |
| `src/app/admin/(panel)/layout.tsx` | Sidebar count uses `awaitsApproval`. |
| `src/app/admin/(panel)/page.tsx` | Dashboard "Pending" tile uses `awaitsApproval`. |
| `src/app/admin/(panel)/properties/page.tsx` | `status=pending` filters with `awaitsApproval`. |
| `src/lib/actions.ts` | `updateProperty` reads the listing first and calls `store.setPropertyStatus(id, "published")` when `publishesOnSave`. |
| `src/lib/schema.sql` | Publishes rentals left pending. |

## Tests

- `src/lib/approvals.test.ts`: pending sales await approval; rentals never do, in any status; a
  pending listing saved as a rental is published, nothing else is.
- `src/lib/actions.test.ts` ("rentals skip Pending Approvals"): switching a pending submission to
  Rent publishes it; a pending sale stays pending; a rental in another status keeps its status.
