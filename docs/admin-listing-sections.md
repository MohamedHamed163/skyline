# Admin listing sections: Primary, Resale and Rentals

The admin sidebar has three listing sections. Each one shows only its own kind of property.

## Admin behaviour

- **Primary Listings** (`/admin/properties?listing=primary`) shows Primary **sales** only.
- **Resale Listings** (`/admin/properties?listing=resale`) shows Resale **sales** only.
- **Rentals** (`/admin/properties?purpose=rent`) shows rentals only.
- Each section's page is headed with its sidebar name (Primary Listings, Resale Listings, Rentals).
- The dashboard's **Primary** and **Resale** counts use the same rule, so they never count rentals.
- In the filter bar, choosing **Rent** together with Primary or Resale shows all rentals: listing
  types don't apply to rentals, so Rent wins.

Before this fix, rentals that stored a Primary or Resale value appeared in the Primary and Resale
sections and were counted on the dashboard.

## Data model

No change. Rentals still carry a `listing_type` value in `properties` (it is not shown anywhere for
them); the admin views ignore it. No deploy-order constraint.

## Code map

| File | Role |
| --- | --- |
| `src/lib/admin-lists.ts` | `listingSection` (primary, resale or rent) and `matchesListing` (the Sale/Rent + Primary/Resale filter). |
| `src/app/admin/(panel)/properties/page.tsx` | Filters the list with `matchesListing` and titles the page after the section. |
| `src/app/admin/(panel)/page.tsx` | Dashboard Primary/Resale counts use `listingSection`. |

## Tests

- `src/lib/admin-lists.test.ts`: rentals always land in Rent; Primary and Resale return sales of that
  type only; Rentals returns rentals only; Rent wins over a listing type; no filter shows everything.
