# Rental codes typed by the admin

When the admin adds a rental, they type its code themselves (for example the unit number they
already use). Rentals no longer get an automatic `SKY-RNT-0001`-style code. Sale listings are
unchanged: Primary and Resale listings still get `SKY-PRM-…` / `SKY-RES-…` codes when they are first
published.

## Admin behaviour

On **Add a rental** (`/admin/properties/new?purpose=rent`), or on **Add a property** with Purpose set
to Rent, a **Rental code** field appears under Purpose and "Price is per":

- It is required. The hint reads: "Shown on the listing and in its web address. Up to 30 English
  letters, numbers and dashes. It can't be changed later."
- Allowed: English letters and digits in groups joined by single dashes, up to 30 characters, e.g.
  `SKY-RNT-0101`, `VILLA12`, `NC-A-3`. Spaces, slashes, other symbols, Arabic letters or digits,
  a leading or trailing dash, or two dashes in a row are refused. The browser checks this as the admin
  submits (the field's `pattern`), and the server checks it again.
- What the admin types is shown and saved in capitals, with spaces around it trimmed: `sky-rnt-0101`
  is saved as `SKY-RNT-0101`.
- The code must be unique across all properties, in any status, sales included. A taken code is
  refused with "The code SKY-RNT-0001 is already used by another property. Please choose a different
  code." Nothing is uploaded or saved, and the form keeps what was typed.
- Switching Purpose to Sale hides the field and the listing gets an automatic sale code instead.
  Switching back to Rent shows what was typed.
- The rental is published straight away with that code, as before.

The code can't be changed afterwards: the edit form has no code field, since the code is part of
the listing's web address and of leads already received. Rentals added before this change keep their
`SKY-RNT-…` codes.

## Customer behaviour

Nothing changes for customers. The rental's page is `/properties/<code>`, and the code is shown on
the card and the property page as before. Codes are looked up in capitals, so `/properties/villa12`
opens `VILLA12`.

## Effects elsewhere

- **Rental requests** on `/admin/leads` used to keep leads whose property code starts with
  `SKY-RNT`. Now they keep leads whose property is a rental (`rentalIds`), whatever its code. A
  listing switched between sale and rent is filtered by what it is now.
- **Automatic sale codes skip taken numbers.** A rental code may look like an automatic one (e.g. the
  admin types `SKY-RES-0042`). When a listing is then published and the sequence's next number is
  already taken, `setPropertyStatus` catches the unique error and tries the next number, up to 10
  times. Sequence numbers are never rolled back, so each try gets a new number.
- The `property_code_rent` sequence is now only used when a listing without a code is published as a
  rental (a pending submission that the admin switched to Rent before approving it).

## Data model

No schema change. `properties.code` is already `text UNIQUE`. A new rental is inserted with its code,
and the code issued on publishing is `COALESCE(code, …)`, so a typed code is kept. Codes are stored
in capitals because the property page upper-cases the code in the URL before looking it up.

**Deploy order:** none.

## Code map

| File | Role |
| --- | --- |
| `src/lib/property-codes.ts` | Pure rules: `MAX_CODE_LENGTH`, `CODE_PATTERN` (also the input's `pattern`), `normalizeCode`, `validCode`, `isCodeConflict` (the unique error on `properties.code`), `rentalIds`. |
| `src/lib/actions.ts` | `createPropertyAdmin`: for rentals, reads `code`, checks it and that it's free (`msg.codeInvalid` / `msg.codeTaken`) before uploading photos, saves it, and reports a code taken in the meantime as `msg.codeTaken`. Public submissions and edits never read a code. |
| `src/lib/store.ts` | `createProperty` takes an optional `code`; `codeTaken(code)`; `setPropertyStatus` retries the code issue on a unique conflict. |
| `src/components/property-fields.tsx` | The Rental code field: new admin listings only, shown and sent for Rent only. |
| `src/app/admin/(panel)/leads/page.tsx` | "Rental requests" filter by the property's purpose. |
| `src/lib/i18n/{en,ar}.ts` | `fields.code`, `fields.codePlaceholder`, `fields.codeHint`, `msg.codeInvalid`, `msg.codeTaken`. |

## Tests

- `src/lib/property-codes.test.ts`: trimming and capitals, allowed and refused codes, the form's
  `pattern` agreeing with the server check (as the browser runs it, with the `v` flag), recognising
  the unique error, and `rentalIds`.
- `src/lib/actions.test.ts` → "rental codes typed by the admin": a rental is published with the
  typed code in capitals; any letters/digits/dashes format works; a missing, invalid or over-long
  code is refused before uploading; a taken code is refused, also when taken during the save; other
  failures still say the save failed; sale listings, public submissions and edits never take a code.
- `src/lib/store.test.ts` → "property codes": the code is written on insert (or NULL), `codeTaken`,
  and `setPropertyStatus` skips taken numbers, gives up after 10, and doesn't retry other errors.
