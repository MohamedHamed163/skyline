# Floor number

Properties can record which floor they are on, from the ground floor (0) up to floor 45. The field
is optional, since villas, twin houses and townhouses usually have no single floor.

## User behaviour

### Property form (`/submit`, admin create and edit)

- "Floor (optional)" sits in the row with area, bedrooms and bathrooms: four across on desktop, two
  by two on phones. Its placeholder reads "0 = ground".
- It is a digits-only `NumberField` like the other numbers (see [forms.md](forms.md)): Arabic digits
  are converted, nothing but digits can be typed, and it holds at most two digits.
- Empty is allowed. Anything above 45 shows "Must be 45 or less" under the field and blocks the
  submit. The server repeats the check and answers "Floor must be a whole number from 0 to 45."
- The admin can change or clear the floor on the edit page. Clearing it removes the floor.

### Where the floor is shown

- **Property page:** a "Floor" card in the key facts, reading "Ground" for 0 or the floor number.
  It is left out when no floor was given. With five facts the grid shows 2 / 3 / 5 per row
  (phone / tablet / wide desktop) instead of 2 / 4.
- **Admin property page:** appended to the summary line, e.g. "… · 95 m² · Floor 3" or
  "· Ground floor".
- Property cards and search filters don't show or use the floor.

## Data model

`properties.floor integer` (nullable), added in `src/lib/schema.sql` with
`ALTER TABLE … ADD COLUMN IF NOT EXISTS`. `NULL` means not given; `0` is the ground floor. Existing
properties keep `NULL` until someone edits them. The pages check `floor == null`, not `=== null`,
because the cached published list ([caching.md](caching.md)) can briefly hold properties from
before this field existed, with no `floor` key at all.

**Deploy order:** run `npm run db:setup` against the database **before** deploying this code.
Creating or saving a property writes the `floor` column, so saves fail until it exists. Reading is
safe either way (a missing column reads as no floor).

## Code map

| File | Role |
| --- | --- |
| `src/lib/types.ts` | `Property.floor: number \| null`. |
| `src/lib/validation.ts` | `PROPERTY_LIMITS.floor` = 0–45. |
| `src/lib/actions.ts` | `parseProperty` checks the optional floor (`checkWholeNumber(…, false)`) and stores empty as `null`. |
| `src/lib/store.ts` | Reads and writes the `floor` column. |
| `src/components/property-fields.tsx` | The Floor `NumberField` (`required={false}`, placeholder). |
| `src/components/number-field.tsx` | New optional `placeholder` prop. |
| `src/lib/format.ts` | `floorText`: "Ground floor" for 0, "Floor {n}" otherwise. |
| `src/app/(site)/properties/[code]/page.tsx` | Floor key fact (`StairsIcon`), only when set. |
| `src/app/admin/(panel)/properties/[id]/page.tsx` | Floor in the summary line. |
| `src/lib/seed.ts`, `scripts/setup-db.mts` | Sample apartments get a floor; the setup script inserts it. |
| `src/lib/i18n/{en,ar}.ts` | `floorN`, `groundFloor`, `property.floor`, `property.ground`, `fields.floor`, `fields.floorPlaceholder`. |

## Tests

- `src/lib/validation.test.ts`: empty, 0 and 45 accepted; 46 and negative values rejected.
- `src/lib/actions.test.ts` → "floor number": empty or missing saved as `null`, 0 and 45 saved,
  46 / decimals / letters rejected with no save, admin edit updates the floor.
- `src/lib/format.test.ts`: `floorText` in English and Arabic, ground floor and numbered floors.
