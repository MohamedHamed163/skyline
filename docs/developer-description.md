# Project and developer descriptions (Primary)

Primary listings are new units sold in a developer's project, so buyers want to know about both the
project and the company building it. A Primary listing therefore has **two descriptions**:

- **About the project**: the listing's normal description, renamed for Primary listings.
- **About the developer**: a separate text about the developer.

Resale listings and rentals are unchanged. They keep a single "Description", shown as "Overview".

## User behaviour

### Property form (`/submit`, admin create and edit)

- On `/submit`, once the seller picks **Primary**, the Description box is labelled "About the
  project", and an "About the developer" box appears right under it. Each box has a placeholder
  hinting at what to write.
- Picking **Resale** relabels the box "Description" and hides "About the developer". The developer
  box stays in the page, hidden and disabled, so switching back to Primary keeps what was typed,
  and a Resale submission never sends it.
- On the admin forms the same switch follows the **Listing type** dropdown, and only applies to
  sales. When the purpose is Rent, the form always shows a single "Description".
- Both boxes are optional and hold up to 2,000 characters each, with the live counter described in
  [forms.md](forms.md). The server rejects longer text, naming the field: "About the developer can
  be at most 2,000 characters." On Primary listings an over-long description is reported as
  "About the project".

### Property page (`/properties/[code]`)

Under the key facts:

- **Primary listings:** an "About the project" section with the description, then an "About the
  developer" section with the developer text. Each one is left out when it's empty.
- **Resale listings and rentals:** a single "Overview" section, as before. A developer text is
  never shown on these.

The free-text search on `/properties` also searches the developer text, so typing a developer's
name finds their Primary listings.

### Admin

The admin reads and edits both texts in the property's edit form. Changing a listing from Primary
to Resale, or its purpose to Rent, and saving **clears** its developer text: only Primary sale
listings keep one. Switching the dropdown back before saving keeps the text.

## Data model

`properties.developer_description text NOT NULL DEFAULT ''`, added in `src/lib/schema.sql` with
`ALTER TABLE … ADD COLUMN IF NOT EXISTS`. Existing properties get `''`. The project text is the
existing `properties.description` column, so nothing is migrated.

The store reads a missing column as `''`, and the page and search handle properties with no
`developerDescription` key at all. The cached published list ([caching.md](caching.md)) can briefly
hold properties from before this field existed.

**Deploy order:** run `npm run db:setup` against the database **before** deploying this code.
Creating or saving a property writes the `developer_description` column, so saves fail until it
exists. Reading is safe either way.

## Code map

| File | Role |
| --- | --- |
| `src/lib/descriptions.ts` | `hasDeveloperDescription` (Primary and for sale) and `descriptionSections`, the ordered, non-empty description blocks the property page shows. Pure, no DB. |
| `src/lib/types.ts` | `Property.developerDescription: string`. |
| `src/lib/validation.ts` | `TEXT_LIMITS.developerDescription` = 2,000. |
| `src/lib/actions.ts` | `parseProperty` checks the lengths (with the Primary label for the description) and keeps the developer text only for Primary sale listings. |
| `src/lib/store.ts` | Reads and writes `developer_description`. |
| `src/components/property-fields.tsx` | Relabels the description and shows the developer box for Primary. The admin Listing type dropdown is now controlled so the form can follow it. New `listingType` prop for `/submit`. |
| `src/components/property-form.tsx` | Passes the seller's Primary/Resale choice to `PropertyFields`. |
| `src/components/limited-text.tsx` | New optional `disabled` prop. |
| `src/app/(site)/properties/[code]/page.tsx` | Renders `descriptionSections` with "Overview", "About the project" or "About the developer" headings. |
| `src/lib/search.ts` | `applySearch` free text includes the developer text. |
| `src/lib/seed.ts`, `scripts/setup-db.mts` | Two sample Primary villas get a developer text; the setup script inserts it. |
| `src/lib/i18n/{en,ar}.ts` | `property.aboutProject`, `property.aboutDeveloper`, `fields.projectDescription(Placeholder)`, `fields.developerDescription(Placeholder)`. |

## Tests

- `src/lib/descriptions.test.ts`: only Primary sales get a developer text; Primary shows project
  then developer, skipping empty ones; Resale and rentals show one overview and never the developer
  text; a cached property with no `developerDescription` key still works.
- `src/lib/actions.test.ts` → "developer description (Primary only)": saved (trimmed) with a
  Primary submission, dropped on Resale, optional, 2,000 accepted and 2,001 rejected naming the
  field, "About the project" in the description error on Primary only, admin edit saves it, and
  switching to Resale or Rent clears it.
- `src/lib/search.test.ts`: the free-text search finds a Primary listing by its developer text, and
  still works on properties cached without the field.
