# Sub-locations

A location can have **sub-locations**: the areas inside it. New Cairo has Fifth Settlement, Rehab
and Madinaty, the North Coast has Marassi and Hacienda Bay, and so on. There are two levels only:
a sub-location always belongs to exactly one location.

A property's place now reads **Compound → Sub-location → Location**, e.g. "Mountain View iCity,
Fifth Settlement, New Cairo". The compound stays free text and still drives the Projects pages.

## What sellers and the admin see on the property forms

On `/submit`, a host's edit form and the admin's property forms, a **District / area** field sits under
Location. It is **optional**.

- If the location has sub-locations: a dropdown with "Not specified", the location's list, and
  **"Other (type it)"**, which opens a text box.
- If the location has none (e.g. Alexandria): just the text box.
- Picking another location resets the sub-location, so a form can't send a sub-location of the wrong
  location. The server checks it anyway ("Please choose an area from the chosen location's list…"),
  and the database enforces it with a foreign key.
- Typed text that matches a listed name (English or Arabic, any case or spacing) is saved as that
  sub-location, so "fifth  settlement" becomes Fifth Settlement.
- Hidden sub-locations are not offered, except to a property that already has one, so editing it
  doesn't drop it.

A host's edit to a published listing carries the sub-location like any other field and only applies
once approved ([host-edit-approval.md](host-edit-approval.md)). The comparison shows it as one
"District / area" row.

## Typed sub-locations

Typed text is saved on that property only and shown as typed ("Golden Square, New Cairo"). It is
**not** added to the shared list, which would fill it with typos and duplicates, and it is not a
search filter option (the keyword search still finds it).

At the top of `/admin/locations`, **Areas typed by sellers** lists each typed value per location,
grouped regardless of case and spacing, with how many properties use it:

- **Add to list** creates a sub-location in that location (the typed text fills the English or Arabic
  name, whichever it's written in) and moves every property that typed it onto the new one.
- **Match to existing** picks one of the location's sub-locations and moves those properties onto it.

A host edit still waiting for approval keeps its typed text; when the admin approves it, text that now
matches a listed name becomes that sub-location.

## What visitors see

- **`/properties` filters:** under each location, its sub-locations appear once the location is
  ticked (CSS `:has`, no JavaScript), each with its listing count. Ones with no listings are greyed
  but still shown. A ticked location matches all of it; ticking some of its sub-locations narrows it
  to those. A ticked sub-location also works on its own. Removing a location chip removes its
  sub-locations too.
- **Links:** `/properties?location=new-cairo&area=new-cairo--fifth-settlement`. The `area` value is
  the sub-location id (see below), so it stays unambiguous for Lasirena, which exists on three coasts.
- **Cards and the property page:** the place line is "Compound, Sub-location, Location", without a
  sub-location that repeats the compound (Marassi, Marassi). The property page adds the sub-location
  to the breadcrumb and the Location section, linked to its search (typed ones aren't linked), and
  includes it in the map search.
- The home tiles and the home search bar stay location-only.

## Admin: managing sub-locations

On `/admin/locations`, each location has an **Areas (n)** section:

| Action | Effect |
| --- | --- |
| **Add** | English and Arabic names (required, unique inside the location, hidden ones included) and an order number. |
| **Edit** | Rename or reorder. The id never changes, so properties and links keep working. |
| **Hide** | Disappears from the forms and filters; its properties keep it and still show it. The confirmation shows how many properties use it. |
| **Restore** | Brings it back. |

Sub-locations are never deleted. The list is ordered by the order number, then the English name. The
seeded lists use your order (kilometre order along the coasts), numbered 10, 20, 30… so there is room
to insert one in between. The admin properties table shows each property's sub-location under its
location, with typed ones in italics.

## Data model

Table `sub_locations` (see `src/lib/schema.sql`):

| Column | Notes |
| --- | --- |
| `id` | `"<location id>--<slug>"`, e.g. `new-cairo--fifth-settlement`. Unique everywhere, never changes, used in URLs. `slugify` never produces `--`, so the location can be read back from it (`subLocationParent`). |
| `location_id` | FK to `locations.id`. |
| `slug` | Slug of the English name at creation; unique per location (`UNIQUE (location_id, slug)`). A taken slug gets `-2`, `-3`, …. |
| `name_en`, `name_ar` | Display names. |
| `sort_order` | Display order. |
| `archived` | `true` = hidden. |

On `properties`:

| Column | Notes |
| --- | --- |
| `sub_location` | Sub-location id or `NULL`. Composite FK `(sub_location, location)` → `sub_locations (id, location_id)`, so it must belong to the property's location. |
| `sub_location_custom` | Typed text, `''` when none. `CHECK (sub_location IS NULL OR sub_location_custom = '')`: never both. |

`getLocations()` returns each location with its `subLocations`, cached under the `locations` tag
(cache key `locations-with-sub-locations`, so copies cached before this change are never read). Every
property read joins the sub-location's names (`subLocationName`), like the location's. Every
sub-location change clears the `locations` and `properties` tags.

### Concurrency

Two admins adding the same sub-location at once compute the same id; the insert is
`ON CONFLICT (id) DO NOTHING`, so the second one reuses the row instead of failing or duplicating it.
"Add to list" and "Match to existing" are a single `UPDATE` matching the typed text in Postgres
(trimmed, spaces collapsed, lower case), so properties typed while the admin was looking are included.

### Migration and deploy order

`npm run db:setup` (safe to re-run) creates the table, adds the two columns, the constraints and the
index, adds Cairo, Ras Sudr, Marsa Matrouh, Hurghada, El Gouna, Sharm El Sheikh and Dahab as
**hidden** locations (restore each one once it has a photo), and seeds 119 sub-locations for North
Coast, Ain Sokhna, Ras Sudr, New Cairo, Giza and Cairo. Seeding is `ON CONFLICT DO NOTHING`, so the
admin's later edits are kept. Existing properties start with no sub-location.

> **Deploy order:** run `npm run db:setup` **before** deploying this version. Every property query
> joins `sub_locations`, so this version fails without the table. The previous version ignores the
> new table and columns, so migrating first is safe.
>
> **Rollback:** redeploying the previous version is safe, and the data stays. One caveat: if the
> previous version changes the location of a property that has a sub-location, that save fails the
> composite foreign key. Clear the sub-location first, or roll forward.

## Scale

The sub-location list is small (~150 rows) and cached, so it adds no database load per page view.
What reaches its limits first is not this feature: `/properties` loads every published listing from
one cached query and filters it in memory (`applySearch`). That is fine at the current size and up to
a few thousand listings, but at roughly 10–20k it outgrows Next's 2 MB cache-entry limit and gets slow.
The fix is moving search into SQL with keyset pagination; the index
`properties_place_idx (status, location, sub_location)` is already in place for it.

## Code map

| File | Role |
| --- | --- |
| `src/lib/locations.ts` | Pure helpers: `readSubLocation` (form → picked id or typed text), `validateSubLocation`, `selectableLocations` (hides hidden ones), `placeParts` / `subLocationLabel`, `customSubLocations`, `subLocationId` / `subLocationParent`, `typedKey`. |
| `src/lib/search.ts` | `areas` in `SearchQuery` (URL `area`), `inPlaces`, `subLocationCounts`, `placeLinks().subLocation`. |
| `src/lib/store.ts` | `getLocations` (with sub-locations), `createSubLocation`, `updateSubLocation`, `setSubLocationArchived`, `linkTypedSubLocation`; property reads join the names. |
| `src/lib/actions.ts` | `parseProperty` reads the sub-location; `approveHostEdit` re-matches typed text; admin actions `createSubLocation`, `updateSubLocation`, `setSubLocationArchived`, `matchTypedSubLocation`. |
| `src/lib/listing-edits.ts` | `subLocation` / `subLocationCustom` are host-editable; one `subLocation` diff row. |
| `src/components/property-fields.tsx` | `SubLocationField`. |
| `src/components/filters.tsx` | Nested sub-location checkboxes and chips. |
| `src/components/location-admin.tsx` | `SubLocationForm`, `SubLocationArchiveButton`, `MatchTypedForm`. |
| `src/app/admin/(panel)/locations/page.tsx` | The Areas sections and the typed-areas panel. |

## Tests

`src/lib/sub-locations.test.ts` covers the pure helpers, search and host edits. `src/lib/actions.test.ts`
("sub-locations on property forms", "approving a host edit with a typed sub-location", "admin
sub-location actions") covers the server actions. Run them with `npm test`.
