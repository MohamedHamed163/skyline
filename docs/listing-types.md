# Listing types: Primary and Resale

Every sale property is either **Primary** (bought new, from the developer) or **Resale**. Rentals
have no listing type. Primary was called "Premium" until October 2026. The rename covers the whole
public site and the admin dashboard, in English (Primary) and Arabic (برايمري).

## User behaviour

- The header links to **Primary** (`/properties?listing=primary`) and **Resale**. Property cards
  show a Primary or Resale badge, and the home page has a Primary row and a Resale row
  (see [homepage.md](homepage.md)).
- The home-page search bar has three tabs: **Primary | Resale | Rent**. There is no "Buy" tab, and
  no tab is selected when the page loads, so a plain search (for a compound, a title or a property
  code) covers every sale listing. Choosing a tab narrows the search to that listing type, or to
  rentals. The tab is sent as `?tab=primary|resale|rent`.
- The filter sidebar on `/properties` still has its own "All / Primary / Resale" choice and the
  "Buy / Rent" choice, so visitors can widen a search again after using a tab.
- Old links with `listing=premium` or `tab=premium` (bookmarks, shared links, the old admin sidebar)
  still work and open the Primary results.

## Admin behaviour

- The sidebar shows **Primary Listings** and the dashboard has a **Primary** count. Both open
  `/admin/properties?listing=primary`.
- The listing-type select on the property form offers Primary and Resale. Public submissions arrive
  with the type the seller picked on `/submit` (see [primary-documents.md](primary-documents.md)),
  and the admin can change it before approving (see [homepage.md](homepage.md)).
- Property codes do not change. Primary listings keep the `SKY-PRM-…` prefix (PRM for Primary), and
  the numbering continues from where it was.

## Data model

- `properties.listing_type` stores `primary` or `resale`. `src/lib/schema.sql` converts old
  `premium` rows with an idempotent `UPDATE … WHERE listing_type = 'premium'`.
- The `property_code_premium` sequence keeps its old name, so primary codes carry on from the last
  number and never repeat. Only the database sees this name.
- **Deploy order: none.** The code reads `premium` as `primary` everywhere (`toListingType`), and
  approval issues a `SKY-PRM-` code for both values. Deploy first, then run `npm run db:setup`
  whenever convenient to tidy the stored values.

## Code map

| File | Role |
| --- | --- |
| `src/lib/types.ts` | `LISTING_TYPES` (`primary`, `resale`) and `toListingType`, which maps the old `premium`. |
| `src/lib/search.ts` | `SEARCH_TABS` (the search-bar tabs), `searchTab` (the tab matching a query), `parseSearch` (reads `tab` and `listing`, accepting `premium`), `groupProjects` (a project is Primary when at least half its listings are). |
| `src/components/search-bar.tsx` | The tabs. None is checked unless the query already has a listing type or is a rent search. |
| `src/lib/store.ts` | `toProperty` reads rows through `toListingType`; `setPropertyStatus` issues `SKY-PRM-` codes. |
| `src/lib/actions.ts` | `parseProperty` reads the admin's listing type through `toListingType`, so a form opened before the rename still saves. |
| `src/lib/i18n/en.ts`, `ar.ts` | Every "Primary" / "برايمري" label: header, search tabs, badges, home rows, About page, admin sidebar and dashboard. |
| `src/lib/schema.sql` | The `premium` → `primary` row migration. |
| `src/lib/seed.ts`, `scripts/setup-db.mts`, `scripts/load-test-units.sql` | Sample and load-test data use `primary`. |

## Tests

- `src/lib/types.test.ts`: `toListingType` accepts `primary` and `resale`, reads `premium` as
  `primary`, and rejects anything else.
- `src/lib/search.test.ts` → "search-bar tabs and listing types": the tabs are Primary, Resale and
  Rent with no Buy tab, no tab is picked by default and a plain search covers all sale listings,
  every tab survives a round trip through the URL, old `premium` links open Primary, and results are
  filtered by the chosen type. `groupProjects` labels a project Primary when at least half its
  listings are.
- `src/lib/actions.test.ts` → "listing type and home page": the admin can set Primary, and an edit
  form still showing `premium` saves as Primary.
- `src/lib/nav.test.ts`: the header highlights Primary on `/properties?listing=primary`.
