# Unit ranges (Primary)

A Primary listing is a developer's project with many units, not one apartment. So instead of a
single value, its **area, bedrooms, bathrooms, floor and price** are each given as a range across
the project's units, for example 100 – 400 m², 3 – 5 bedrooms, floors 1 – 10, 1 – 3 bathrooms and
5,000,000 – 12,000,000 EGP.

Resale listings and rentals are unchanged: one value for each field.

## User behaviour

### Property form (`/submit`, `/account` edit, admin create and edit)

- Once the seller picks **Primary** (or the admin sets the Listing type to Primary on a sale), each
  of the five fields shows two boxes side by side: **From** and **To**, with a hint above them:
  "Give the range across the project's units. Leave “To” empty when every unit is the same."
- **From** is the existing field and keeps its rules (area, bedrooms, bathrooms and price required,
  floor optional, same limits as before, see [forms.md](forms.md)).
- **To** is optional. Empty means every unit has the same value. It has the same limits as its field
  and, while typing, can't go below the From value ("Must be at least 100.").
- Picking **Resale** (or Rent on the admin form) hides the To boxes. They stay in the page, hidden
  and disabled, so switching back keeps what was typed, and a Resale or rental save never sends them.

The server checks the same rules and names the field in its errors:

- "Area (m²): the “to” value must be at least the “from” value."
- "Bedrooms “to” value must be a whole number from 0 to 50."
- "Floor: fill in the “from” value too, or leave “to” empty." (a To floor needs a From floor)

A To equal to its From is saved as no range, so it shows as a single value.

### Where ranges are shown

- **Property cards** (search, home page, project pages): "3 – 5 beds", "1 – 3 baths",
  "100 – 400 m²", and the price as "5,000,000 – 12,000,000 EGP".
- **Property page** (`/properties/[code]`): the same in the price and the key facts; the floor fact
  reads "Ground – 10" when the range starts at the ground floor. The "price per m²" next to the
  price is left out when the area or price is a range, since it differs from unit to unit.
- **Admin property page**: the summary line shows the ranges ("Floor 0 – 10" for floors).
- **Projects and market figures**: a project's and a location's price range run up to the top of
  each listing's price range. Average price per m² uses each listing's From price and From area.

### Search (`/properties`)

A Primary listing matches a filter when **any of its units could fit**, i.e. its range overlaps the
filter:

| Filter | A ranged listing matches when |
| --- | --- |
| Bedrooms 4+ / Bathrooms 2+ | its To value is at least the filter |
| Min area / Min price | its To value is at least the minimum |
| Max area / Max price | its From value is at most the maximum |

Sorting: "Price: low to high" uses each listing's From price; "Price: high to low" and
"Area: largest first" use its To value.

### Host edits

A host's ranges are part of their edit like any other field. On a published listing the edit is held
for the admin ([host-edit-approval.md](host-edit-approval.md)), and the comparison lists each changed
To value as its own row, e.g. "Area (m²) “to” value: — → 400 m²".

## Data model

Five nullable columns in `properties`, added in `src/lib/schema.sql` with
`ALTER TABLE … ADD COLUMN IF NOT EXISTS`:

| Column | Type | "To" value of |
| --- | --- | --- |
| `area_max` | integer | `area` |
| `bedrooms_max` | integer | `bedrooms` |
| `bathrooms_max` | integer | `bathrooms` |
| `floor_max` | integer | `floor` |
| `price_max` | bigint | `price` |

The existing columns keep holding the From values, so nothing is migrated and everything that reads
`price`, `area` etc. (search, sorting, codes) keeps working. NULL means no range. They are always
NULL on Resale listings and rentals: saving a listing as Resale or Rent clears them.

In TypeScript they are `Property.areaMax`, `bedroomsMax`, `bathroomsMax`, `floorMax` and `priceMax`
(`number | null`). The store reads missing columns as `null`, and every reader treats a missing key
as no range, so the cached published list ([caching.md](caching.md)) and host edits held from before
this change both keep working.

**Deploy order:** run `npm run db:setup` against the database **before** deploying this code.
Creating or saving a property writes the new columns, so saves fail until they exist. Reading is
safe either way.

## Code map

| File | Role |
| --- | --- |
| `src/lib/unit-ranges.ts` | Pure helpers: `RANGE_KEYS`, `MAX_KEYS`, `hasUnitRanges`, `upper` (the top of a range), `isRange`, `rangeText` ("3 – 5"), `checkRange` and `storedMax`. |
| `src/lib/types.ts` | The five `*Max` fields on `Property`. |
| `src/lib/actions.ts` | `parseProperty` reads, checks and keeps the To values for Primary sale listings only. |
| `src/lib/store.ts` | Reads and writes the `*_max` columns (`rangeColumns`), for admin saves and host edits. |
| `src/lib/listing-edits.ts` | The To values are host-editable and compared as their own rows. |
| `src/components/property-fields.tsx` | `RangeField`: the From box plus a To box shown on Primary listings, whose minimum follows From. |
| `src/lib/pricing.ts` | `priceSpan` and `priceLabel` give a sale's price range. |
| `src/lib/format.ts` | `formatNumber`; `floorText` takes an optional To floor. |
| `src/lib/search.ts` | Overlap filters, range-aware sorting, and project/location price ranges. |
| `src/components/property-card.tsx`, `src/app/(site)/properties/[code]/page.tsx`, `src/app/admin/(panel)/properties/[id]/page.tsx`, `src/components/host-edit-review.tsx` | Show the ranges. |
| `src/lib/seed.ts`, `scripts/setup-db.mts` | The sample Primary villa has ranges; the setup script inserts them. |
| `src/lib/i18n/{en,ar}.ts` | `fields.rangeFrom`, `rangeTo`, `rangeToField`, `rangeHint`; `msg.rangeOrder`, `rangeNoFrom`. |

## Tests

- `src/lib/unit-ranges.test.ts`: only Primary sales have ranges; `upper`/`isRange` with and without
  a To value, on cached properties without the keys, and with no floor; `rangeText`; `checkRange`
  and `storedMax`.
- `src/lib/actions.test.ts` → "unit ranges (Primary only)": all five saved with a Primary submission;
  To optional and a To equal to From saved as none; dropped (even invalid) on Resale; To below From
  and out-of-limit To rejected naming the field; a To floor needs a From floor; the admin edits
  them, and switching to Resale or Rent clears them. The host-accounts block checks a host's ranges
  are held with their edit.
- `src/lib/search.test.ts` → "Primary unit ranges in search": overlap matching for bedrooms,
  bathrooms, area and price; no match when the whole range is outside; sorting by From/To; project
  and location price ranges.
- `src/lib/pricing.test.ts`: a Primary price range label in English and Arabic, with search using the
  From price.
- `src/lib/format.test.ts`: `floorText` with a range.
- `src/lib/listing-edits.test.ts`: a changed To value is its own row in the comparison.
