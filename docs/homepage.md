# Home page sections

The home page fills itself from published listings. The admin controls two things on each property,
from the property's edit form at `/admin/properties/<id>` (or when adding one):

- **Listing type** (Primary / Resale, see [listing-types.md](listing-types.md)) decides whether a
  sale property appears in the Primary or the Resale row.
- **Show on the home page** (a checkbox) puts the property first in its row.

Nothing else needs configuring. If no property is ticked, every row just shows the newest listings.

## Admin behaviour

- The seller picks Primary or Resale first thing on the public `/submit` form (see
  [primary-documents.md](primary-documents.md)). The admin can switch it before approving if needed.
  The property code (`SKY-PRM-…` / `SKY-RES-…`) is issued on first approval from the listing type at
  that moment and never changes afterwards, so set the type before approving.
- Ticking **Show on the home page** marks the property with "★ On home page" in the properties list
  and on its admin page. Unticking it puts it back in the normal order.
- Rentals have no listing type, but they can also be shown on the home page.

## What each section shows

| Section | Rule |
| --- | --- |
| Featured projects | Sale properties grouped by compound. Compounds with a ticked property come first, then the ones with the most listings. 4 shown. |
| Primary / Resale | Published sale properties of that listing type: ticked first, then newest. 3 shown. |
| Rentals | Published rentals: ticked first, then newest. 3 shown. |

Only **published** properties are ever shown. Ticking a pending property does nothing until it is
approved.

## Data model

`properties.featured boolean NOT NULL DEFAULT false` (added in `src/lib/schema.sql`). Run
`npm run db:setup` **before** deploying this code, since the code reads and writes the column.
Existing rows default to not featured, so the home page looks the same until the admin ticks something.

## Code map

| File | Role |
| --- | --- |
| `src/lib/types.ts` | `Property.featured`, `Property.listingType`. |
| `src/lib/actions.ts` | `parseProperty`: admin forms set `listingType` and `featured`; public submissions keep the seller's listing type (resale when an old form sends none) and are never featured. |
| `src/components/property-fields.tsx` | Listing-type select and "Show on the home page" checkbox, admin only. |
| `src/lib/search.ts` | `featuredFirst` (stable, featured to the front) and `groupProjects` (featured projects first). |
| `src/app/(site)/page.tsx` | Builds the rows with `featuredFirst` / `groupProjects`. |
| `src/app/admin/(panel)/properties/page.tsx`, `[id]/page.tsx` | "★ On home page" marker. |

## Tests

- `src/lib/search.test.ts`: `featuredFirst` keeps the order apart from moving featured items to the
  front, and `groupProjects` puts featured projects first.
- `src/lib/actions.test.ts` → "listing type and home page": public submissions ignore
  `listingType`/`featured`, and the admin can set primary, tick and untick the checkbox, and is
  blocked from using an unknown listing type.
