# Forms: validation and failed submissions

The property form is used on `/submit` (brokers and owners), `/admin/properties/new` and the admin
edit page. This page covers how its numeric fields are checked, what happens when a save fails (on
every form in the site, not just this one), and how dropdowns look across the site.

## User behaviour

### Numeric fields (price, area, bedrooms, bathrooms, floor)

- They are text fields (`NumberField`), not `<input type="number">`, so there are no spinner arrows,
  no scroll-wheel changes and no `e`, `-` or `.` input. Anything that isn't a digit is dropped as
  you type or paste. Arabic digits (`٠١٢٣`) are converted to `0123`. Phones get the numeric keypad.
- Price and area are shown with thousands separators (`2,500,000`). The form still sends plain
  digits, and the caret stays where you are typing as commas appear.
- Allowed ranges (`PROPERTY_LIMITS`):

  | Field | Min | Max |
  | --- | --- | --- |
  | Price (EGP, sale or rent) | 1 | 1,000,000,000 |
  | Area (m²) | 1 | 5,000 |
  | Bedrooms | 0 | 50 |
  | Bathrooms | 0 | 50 |
  | Floor (optional, 0 = ground; see [floor.md](floor.md)) | 0 | 45 |

- A field can't hold more digits than its maximum has (10 for price, 4 for area). Extra keystrokes
  are ignored, and a long paste keeps the digits that fit.
- Errors appear under the field as soon as you type or leave it ("Must be 1,000,000,000 or less",
  "This field is required."), with a red border. Submitting with an invalid field is blocked by the
  browser, which focuses the first bad field and shows its error.
- The server checks the same ranges, so a request that skips the form gets
  "Price (EGP) must be a whole number from 1 to 1,000,000,000."

### Title and description length

- The property title is limited to 120 characters and the description to 2,000 (`TEXT_LIMITS`).
  Primary listings' "About the developer" text is also limited to 2,000
  ([developer-description.md](developer-description.md)).
  The browser stops typing at the limit and trims a paste to fit.
- A live counter under each field shows `45 / 120`. It turns amber from 90% of the limit and red at
  the limit. It always reads left to right, in Arabic too, and screen readers hear "{n} of {max}
  characters left".
- The server rejects longer text ("Property title can be at most 120 characters.") instead of
  cutting it off without telling anyone.

### Failed submissions keep the form

- Nothing is cleared when a save fails, whether the server rejects the input, the database is down
  or the connection drops. Typed values, selected options and added photos all stay, and the error
  is shown above the submit button.
- A dropped connection or a server crash shows "We couldn't reach the server. Check your connection
  and try again — your details are still here." instead of replacing the page with an error screen.
- The public form only clears after a successful submission (the "Property submitted" screen). The
  admin create form redirects to the new property. The edit form reloads the saved values after a
  successful save.

### Every other form

The same rule applies site-wide: a failed request never clears the form or replaces the page with an
error screen.

| Form | On failure |
| --- | --- |
| Contact / "Request more information" (`LeadForm`) | Keeps what was typed; "your details are still here" message. |
| Admin sign-in | Keeps the password field; message under it. |
| Locations: add / edit | Keeps names and the picked cover. The add form only clears after a location is added. |
| Property status buttons, lead status + notes, "Request changes", hide/restore location, logout | `ActionForm`: keeps typed notes, shows "Couldn't reach the server…" under the form. Its controls are disabled while the request runs. |
| Language switch (header) | Same, with the message floating under the button so the header layout doesn't move. |

Redirects (admin create, sign-in, logout) still work: they are re-thrown, not treated as failures.

### Dropdowns

Every `<select class="field">` uses a custom chevron inset from the edge (0.85rem), with room
reserved so long labels never run under it. It sits on the right in English and on the left in
Arabic. The sort dropdown on `/properties` has its own icon and spinner (see [sorting.md](sorting.md)).

## Data model

No change here. `area`, `bedrooms`, `bathrooms` and `floor` (nullable) are `integer` and `price` is `bigint` in
`src/lib/schema.sql`; the limits keep values well inside both.

## Code map

| File | Role |
| --- | --- |
| `src/lib/validation.ts` | `PROPERTY_LIMITS`, `TEXT_LIMITS`, `counterTone`, `checkWholeNumber`, `digitsOnly` / `toLatinDigits`, `maxDigits`, `groupDigits`, `caretAfterDigits`. Shared by the client field and the server action. |
| `src/components/number-field.tsx` | `NumberField`: digits-only controlled input, live error, `setCustomValidity` to block submit, hidden input carrying the raw digits under `name`. |
| `src/components/limited-text.tsx` | `LimitedText`: input or textarea with `maxLength` and the live counter. |
| `src/components/property-fields.tsx` | Uses `NumberField` for price, area, bedrooms, bathrooms and floor (optional), and `LimitedText` for title and description. |
| `src/components/property-form.tsx`, `src/components/edit-property-form.tsx` | Submit from `onSubmit` + `startTransition` instead of `<form action>`, because React resets a form after its action runs, even when it fails. |
| `src/lib/safe-action.ts` | `succeeded`: runs a request and returns false if it throws, re-throwing Next.js redirects via `unstable_rethrow`. `withFailureMessage`: wraps a server action for `useActionState` so a thrown request becomes `{ ok: false, message }`. |
| `src/components/action-form.tsx` | `ActionForm`: `<form>` for server actions that return nothing. Submits from `onSubmit` with the clicked button (`submitter`), disables its controls while pending, optional `confirm`, inline error on failure. |
| `src/components/lead-form.tsx`, `login-form.tsx`, `location-admin.tsx` | `withFailureMessage` + `onSubmit` submission, as in the property forms. |
| `src/components/admin-ui.tsx`, `language-switch.tsx`, `src/app/admin/(panel)/layout.tsx`, `src/app/admin/(panel)/properties/[id]/page.tsx` | Use `ActionForm`. |
| `src/lib/actions.ts` | `parseProperty` checks each number against `PROPERTY_LIMITS` (`msg.numberRange`) and title/description against `TEXT_LIMITS` (`msg.textTooLong`). |
| `src/app/globals.css` | `select.field` chevron, flipped under `[dir="rtl"]`. |
| `src/lib/i18n/{en,ar}.ts` | `fields.errors.*`, `fields.charsLeft`, `msg.numberRange`, `msg.textTooLong`, `msg.requestFailed`, `msg.actionFailed`. |

## Tests

- `src/lib/validation.test.ts`: ranges (including the price and area caps), non-digit input,
  required vs optional, Arabic digit conversion, digit stripping, grouping and caret placement;
  `counterTone` thresholds.
- `src/lib/safe-action.test.ts`: `withFailureMessage` passes results through and turns a failed
  request into the message; `succeeded` reports success/failure; both re-throw redirects.
- `src/lib/actions.test.ts` → "numeric property limits": maximum price and area accepted, values
  over the caps, decimals, exponents, zero and empty values rejected without saving.
- `src/lib/actions.test.ts` → "text length limits": title and description at the limit accepted,
  one character over rejected with the right message.
