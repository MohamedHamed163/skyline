# Property page

The public listing page at **`/properties/[code]`** (published properties only; seller details are
never shown).

## Descriptions

Under the key facts, Resale listings and rentals show their description as "Overview". Primary
listings show "About the project" and then "About the developer", each only when filled in. See
[developer-description.md](developer-description.md).

## Location section

Below the features, the "Location" section shows:

- **Location**: the location name in the current language. It links to `/properties` filtered by
  that location and the property's purpose (sale/rent).
- **Compound / project**: the compound name, linking to its project page
  (`/projects/<slug>`). Compound is optional, so this item is **hidden** when the property has
  none (no "—" placeholder).
- A Google Maps embed of the approximate area (see below).

Each item is an icon with the label above the value, and the value is a gold link with a chevron.
There are no underlined label/value rows, which looked like form fields.

The breadcrumb uses the same links.

### Map

The map uses Google's keyless embed URL
(`https://www.google.com/maps?q=<compound>, <location>, Egypt&z=12&output=embed`). Google looks
the place up by name, so it shows the area, not the exact unit. The English location name is
always used for the lookup. No API key or stored coordinates are involved.

## Data model

No schema of its own. It reads `Property.location`, `locationName` and `compound` (see
[locations](locations.md)).

## Code map

| File | Role |
| --- | --- |
| `src/app/(site)/properties/[code]/page.tsx` | The page, including the `PlaceLink` item used in the location section. |
| `src/lib/search.ts` | `placeLinks(property)`: the location search link, and the project link (`null` without a compound). |

## Tests

`src/lib/search.test.ts` → `placeLinks`: the location link keeps the location and purpose, the
compound links to its project slug, and an empty or blank compound gives no project link.
