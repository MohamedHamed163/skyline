# Property form: validation and failed submissions

The property form is used on `/submit` (brokers and owners), `/admin/properties/new` and the admin
edit page. This page covers how its numeric fields are checked, what happens when a save fails, and
how dropdowns look across the site.

## User behaviour

### Numeric fields (price, area, bedrooms, bathrooms)

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

- A field can't hold more digits than its maximum has (10 for price, 4 for area). Extra keystrokes
  are ignored, and a long paste keeps the digits that fit.
- Errors appear under the field as soon as you type or leave it ("Must be 1,000,000,000 or less",
  "This field is required."), with a red border. Submitting with an invalid field is blocked by the
  browser, which focuses the first bad field and shows its error.
- The server checks the same ranges, so a request that skips the form gets
  "Price (EGP) must be a whole number from 1 to 1,000,000,000."

### Failed submissions keep the form

- Nothing is cleared when a save fails, whether the server rejects the input, the database is down
  or the connection drops. Typed values, selected options and added photos all stay, and the error
  is shown above the submit button.
- A dropped connection or a server crash shows "We couldn't reach the server. Check your connection
  and try again — your details are still here." instead of replacing the page with an error screen.
- The public form only clears after a successful submission (the "Property submitted" screen). The
  admin create form redirects to the new property. The edit form reloads the saved values after a
  successful save.

### Dropdowns

Every `<select class="field">` uses a custom chevron inset from the edge (0.85rem), with room
reserved so long labels never run under it. It sits on the right in English and on the left in
Arabic. The sort dropdown on `/properties` has its own icon and spinner (see [sorting.md](sorting.md)).

## Data model

No change. `area`, `bedrooms` and `bathrooms` are `integer` and `price` is `bigint` in
`src/lib/schema.sql`; the limits keep values well inside both.

## Code map

| File | Role |
| --- | --- |
| `src/lib/validation.ts` | `PROPERTY_LIMITS`, `checkWholeNumber`, `digitsOnly` / `toLatinDigits`, `maxDigits`, `groupDigits`, `caretAfterDigits`. Shared by the client field and the server action. |
| `src/components/number-field.tsx` | `NumberField`: digits-only controlled input, live error, `setCustomValidity` to block submit, hidden input carrying the raw digits under `name`. |
| `src/components/property-fields.tsx` | Uses `NumberField` for price, area, bedrooms and bathrooms. |
| `src/components/property-form.tsx`, `src/components/edit-property-form.tsx` | Submit from `onSubmit` + `startTransition` instead of `<form action>`, because React resets a form after its action runs, even when it fails. |
| `src/lib/safe-action.ts` | `withFailureMessage`: wraps a server action for `useActionState`, turning a thrown request into `{ ok: false, message }` and re-throwing Next.js redirects via `unstable_rethrow`. |
| `src/lib/actions.ts` | `parseProperty` checks each number against `PROPERTY_LIMITS` and returns `msg.numberRange`. |
| `src/app/globals.css` | `select.field` chevron, flipped under `[dir="rtl"]`. |
| `src/lib/i18n/{en,ar}.ts` | `fields.errors.*`, `msg.numberRange`, `msg.requestFailed`. |

## Tests

- `src/lib/validation.test.ts`: ranges (including the price and area caps), non-digit input,
  required vs optional, Arabic digit conversion, digit stripping, grouping and caret placement.
- `src/lib/safe-action.test.ts`: results pass through, a failed request becomes the message,
  redirects are re-thrown.
- `src/lib/actions.test.ts` → "numeric property limits": maximum price and area accepted, values
  over the caps, decimals, exponents, zero and empty values rejected without saving.
