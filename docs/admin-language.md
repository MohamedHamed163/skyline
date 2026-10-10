# Admin in Arabic and English

The admin dashboard follows the language switch, like the public site. The whole page flips to
right-to-left in Arabic (`<html dir>`).

## Rules the admin pages follow

- **Every label comes from the dictionary** (`src/lib/i18n/en.ts` / `ar.ts`; `ar` is typed as `Dict`,
  so a missing Arabic key fails `tsc`).
- **Use logical spacing and alignment** (`ms-`/`me-`, `start`/`end`, `text-start`), never `ml-`/`mr-`
  or `left`/`right`. Back arrows flip with `t.dir`.
- **Phone numbers, emails and codes** go in an inner `<span dir="ltr">`, never on the table cell itself,
  so the cell still lines up with its header in Arabic. Separators (`·`) stay outside that span.
- **Text people typed** (lead messages, internal notes) is shown with `dir="auto"` so it reads in its
  own language. Form fields don't use `dir="auto"`: an empty field would fall back to left-to-right
  and push the Arabic placeholder to the wrong side.
- **Skyline's own listings** are saved with the seller name `Skyline` (`COMPANY_DEFAULT_NAME`). The
  admin shows them as the site name in the current language (سكاي لاين), without the repeated
  "(Skyline (company))" suffix (`sellerName` / `sellerWithType` in `src/lib/sellers.ts`).
- **Unknown admin URLs** (e.g. a property id that doesn't exist) show a translated not-found page
  inside the dashboard (`src/app/admin/(panel)/not-found.tsx`).

## Known gaps

- Counts are not pluralised (e.g. "1 beds"); the dictionary has no plural forms yet.
- The WhatsApp greeting to a customer uses the admin's current language.

## Tests

`src/lib/sellers.test.ts`: the company name shows in the right language, and the seller type is added
for brokers and owners but not repeated for Skyline's own listings.
