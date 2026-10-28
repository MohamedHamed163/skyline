# Locations

Locations (New Cairo, Giza, …) are managed by the admin at **`/admin/locations`**. They are no longer
hard-coded. Whatever is listed there drives:

- the location dropdown in the property forms (public `/submit` and the admin forms),
- the location filters and search bar on `/properties`,
- the "Browse by location" tiles, the market snapshot and the "popular searches" on the home page.

## What an admin can do

| Action | Effect |
| --- | --- |
| **Add** | English and Arabic names are required, and a cover photo for the home-page tile is optional. Names must be unique in each language, hidden locations included. |
| **Edit** | Change the names or replace/remove the photo. The location's id never changes, so existing properties and shared search links keep working. |
| **Hide** | The location disappears from the forms, filters and home page. Its properties keep it and still show its name. The confirmation dialog shows how many properties use it. |
| **Restore** | Brings a hidden location back everywhere. |

Each location can have **sub-locations** (areas such as Fifth Settlement in New Cairo), managed on
the same page. See [sub-locations.md](sub-locations.md).

Locations are never deleted. Properties reference them through a foreign key, and hiding replaces
deletion.

When an admin edits a property that sits on a hidden location, the form still offers that location
(tagged "hidden"), so saving doesn't force a change. Public submissions can only use visible
locations.

## Data model

Table `locations` (see `src/lib/schema.sql`):

| Column | Notes |
| --- | --- |
| `id` | Slug of the English name at creation (`new-cairo`). A taken slug gets `-2`, `-3`, …. Used in URLs (`/properties?location=new-cairo`). |
| `name_en`, `name_ar` | Display names. |
| `cover` | Vercel Blob URL (uploads go to `locations/`) or a `/listings/…` path. `NULL` falls back to `DEFAULT_LOCATION_COVER`. |
| `archived` | `true` = hidden. |

`properties.location` holds the location id (FK to `locations.id`). Every property query joins the
names in (`PROPERTY_SELECT` in `src/lib/store.ts`), so a `Property` carries
`locationName: { en, ar }`. Pages display it with `localName(t, p.locationName)` and never need
the full location list.

### Migration

`npm run db:setup` (safe to re-run) creates the table, inserts the seven original locations once
(`ON CONFLICT DO NOTHING`, so an admin's later edits are kept), converts old rows that stored the
English name (`"New Cairo"`) to the id (`new-cairo`), and adds the foreign key.

> **Deploy order:** the previous app version stores English names and would fail the new foreign
> key. It also looks up the location label by English name, so after the migration it shows a
> blank location (just the pin icon) on every property. Run the migration and deploy this version
> together.

## Code map

| File | Role |
| --- | --- |
| `src/lib/locations.ts` | Pure helpers: `slugify`, `uniqueSlug`, `validateLocation`, `selectableLocations`, `localName` / `locationLabel`. |
| `src/lib/store.ts` | `getLocations` (all, cached per request), `getActiveLocations`, `createLocation`, `updateLocation`, `setLocationArchived`. |
| `src/lib/actions.ts` | Admin server actions `createLocation`, `updateLocation`, `setLocationArchived`. Property forms validate the location against the DB. |
| `src/lib/search.ts` | `locationStats(published, locations)` and `popularLocationSearches(published, locations)`. |
| `src/app/admin/(panel)/locations/page.tsx` | Admin page. |
| `src/components/location-admin.tsx` | `LocationForm` (add/edit, photo picker) and `LocationArchiveButton`. |

## Tests

`src/lib/locations.test.ts`, `src/lib/search.test.ts` and `src/lib/actions.test.ts`. Run them with
`npm test`.
