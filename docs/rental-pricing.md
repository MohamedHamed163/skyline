# Rental prices that change by date

A rental's price can change by date: weekend nights can cost more than weekdays, and seasons such
as June and July on the North Coast, or holidays such as Eid, can have their own price. The admin
sets these on the rental form. Customers see "From …" prices and the price of each night (or month)
on the property page's calendar.

## Admin behaviour

Everything is on the rental form: **Add a rental** (`/admin/properties/new?purpose=rent`) and
**Edit property** on a rental's admin page. Prices are saved with **Publish** / **Save changes**,
like every other field. They aren't saved on their own the way booked days are
([rental-calendar.md](rental-calendar.md)).

### Nightly rentals ("Price is per: night")

- **Standard price per night (EGP)**: required. Charged for every night that has no weekend or
  special price.
- **Weekend nights (EGP)** (optional), next to it: charged for **Thursday and Friday nights**. A night
  is named by its check-in day, so Thursday night is the stay from Thursday to Friday. Leave it empty
  to charge the standard price at weekends too.
- **Special prices** (optional), underneath: a two-month calendar (one month on phones) from today up
  to 12 months ahead. Each night shows its price as you type the prices above. Weekend nights are
  tinted beige and special prices gold, with a legend underneath.
  - **Click a month's name** (for example "June 2027") to select the whole month, or **click a first
    and a last night** to select the nights between them. While choosing the last night, hovering
    previews the range. A third click starts a new selection. <kbd>Esc</kbd> or **Cancel** clears it.
  - A bar opens under the calendar ("Selected: Tue, 1 Jun 2027 – Sat, 31 Jul 2027 (61 nights)") with
    **Price per night** and an optional **Weekend nights** price for that run. **Apply** (or
    <kbd>Enter</kbd> in either box) sets it. If the weekend price is left empty, the run's price is
    charged on its weekend nights too, not the standard weekend price.
  - **Use standard price** returns the selected nights to the standard and weekend prices. It is
    disabled when none of them has a special price.
  - Selecting nights that already have one special price fills in that price, so changing a season
    is: click it, edit the number, Apply.
  - Setting a price on part of a run splits the run. Touching runs with the same prices are merged.
- **Special prices set**: the list under the calendar, one line per run ("Tue, 1 Jun 2027 – Sat, 31
  Jul 2027 · 8,000 EGP / night, weekend nights 10,000 EGP"), each with **Edit** (selects it) and
  **Remove**.

### Monthly rentals ("Price is per: month")

- **Standard price per month (EGP)**: required. There is no weekend price.
- **Special prices**: a grid of this month and the 12 after it, each tile showing its price. Click
  a month, or a first and a last month, enter **Price per month** and Apply. The list and buttons
  work as for nights.

### Safety nets

- If a price is typed in the bar but not applied, **Publish / Save changes is blocked** and the
  browser points at the box: "Press Apply to add this price, or Cancel." Opening a special price
  with Edit and leaving it unchanged doesn't block saving.
- A price outside 1 … 1,000,000,000 shows "Enter a price from 1 to 1,000,000,000." in the bar and
  isn't applied.
- Switching "Price is per" between night and month keeps each period's special prices while the
  form is open; only the current period's are saved. Switching Purpose to "For sale" hides the
  rental pricing; saving a sale listing clears its weekend and special prices.
- Special prices that are over are dropped when the form is saved, and a run that has started is
  saved from today.

## Customer behaviour

- When a rental's price changes over the next 12 months, cards, the property page and the admin
  lists show **"From 3,000 EGP / night"**: the lowest price from today on. Rentals with one price
  still show "3,000 EGP / night".
- On the property page, a line under the price says "Prices change by date. Each free night shows
  its price on the calendar below." and links to the Availability calendar.
- The Availability calendar shows the price under each free night. Booked and past days show no
  price. Screen readers hear "Wed, 14 Oct 2026, available, 3,000 EGP". On monthly rentals, each
  month's price is shown under its name ("25,000 EGP / month").
- Nothing changes for rentals with one price: no "From", no prices on the days.
- **Search**: the price filter and "Price: low to high / high to low" use the same "From" price for
  rentals, so a result always matches the price on its card. Sale listings are unchanged.

## Data model

Two columns on `properties`, added in `src/lib/schema.sql`:

- `weekend_price bigint` (NULL = none): nightly rentals only; always NULL otherwise.
- `price_rules jsonb NOT NULL DEFAULT '[]'`: special prices, `[{ "from", "to", "price",
  "weekendPrice" }]`. `from`/`to` are `"YYYY-MM-DD"` Cairo days for nightly rentals and
  `"YYYY-MM"` months for monthly ones, both ends included. Runs are sorted and never overlap.
  `weekendPrice` is null on monthly rentals. Always `[]` for sales.

A night's price is resolved in this order: a special price (its weekend price on Thursday and Friday
nights, if it has one), then the weekend price on Thursday and Friday nights, then the standard
`price`. The weekend nights are `WEEKEND_NIGHTS` in `src/lib/pricing.ts`; the form labels and hints
name them in `fields.weekendHint` and `fields.weekendPrice`, so change those too if they ever change.

- The form sends the runs as JSON in a hidden `priceRules` field. `readPriceRules` refuses anything
  malformed (bad JSON, more than 100 runs, impossible or wrong-period keys, prices that aren't whole
  numbers from 1 to 1,000,000,000, a weekend price on a monthly rental) with "The special prices
  couldn't be saved. Check them and try again." Overlapping runs are accepted, later ones winning,
  and the result is tidied (`tidyPriceRules`).
- Runs are kept within the booking calendar's horizon: today (this month) up to the end of the month
  12 months ahead.
- Both fields are part of the cached published list ([caching.md](caching.md)). The list stays small:
  one entry per run, not per night. Lists cached before the fields existed have neither key, so the
  pricing functions treat a missing `weekendPrice` / `priceRules` as none.

**Deploy order:** run `npm run db:setup` against the database **before** deploying this code. Every
property save (admin forms and public submissions) writes the two new columns and fails until they
exist. Reading is safe either way: missing columns read as no weekend or special prices.

## Code map

| File | Role |
| --- | --- |
| `src/lib/pricing.ts` | Pure pricing logic: `WEEKEND_NIGHTS`, `isWeekendNight`, `isMonth`, `nightQuote`, `monthQuote`, `priceSpan`, `pricesVary`, `listPrice`, `priceLabel`, `setPriceRule`, `tidyPriceRules`, `readPriceRules`, `MAX_PRICE_RULES`, and the editor helpers `monthNights`, `countKeys`, `pricedMonths`, `ruleCovering`, `hasRuleIn`. |
| `src/lib/types.ts` | `PriceRule`; `Property.weekendPrice` and `Property.priceRules`. |
| `src/lib/actions.ts` | `parseProperty` reads `weekendPrice` (nightly rentals) and `priceRules` (rentals), returning `msg.numberRange` / `msg.priceRulesFailed` on bad input. |
| `src/lib/store.ts` | Reads `weekend_price` / `price_rules`; writes them for rentals only (NULL / `[]` otherwise). |
| `src/lib/search.ts` | `applySearch` filters and sorts by `listPrice` (the "From" price). |
| `src/components/special-prices.tsx` | `SpecialPrices`: the admin calendar / month grid, selection bar, list and hidden `priceRules` input. |
| `src/components/property-fields.tsx` | Standard price label per period, the Weekend nights field and the Special prices block, all kept mounted but disabled when they don't apply. |
| `src/components/number-field.tsx` | `useDigits` (digit-only typing state shared with the selection bar) and `NumberField`'s `onValueChange`, which feeds the live calendar prices. |
| `src/components/availability-calendar.tsx` | `CalendarMonths` takes an optional `title` renderer (month-name buttons, monthly prices). `AvailabilityCalendar` shows prices when they vary. |
| `src/components/property-card.tsx` | `priceText` → `priceLabel` with today in Cairo, used by cards, the property page and admin lists. |
| `src/app/(site)/properties/[code]/page.tsx` | "Prices change by date" line linking to `#availability`; passes the rental to the calendar. |
| `src/app/admin/(panel)/properties/new/page.tsx`, `[id]/page.tsx`, `src/components/property-form.tsx`, `edit-property-form.tsx` | Pass `cairoToday()` to the form. |
| `src/lib/i18n/{en,ar}.ts` | `fields.standardPrice`, `fields.weekendPrice`, `fields.weekendHint`, `admin.pricing.*`, `property.pricesVary`, `calendar.dayAvailablePrice`, `rentFrom`, `msg.priceRulesFailed`. |

## Tests

- `src/lib/pricing.test.ts`: Thursday and Friday weekend nights, month keys, each night's and
  month's price (standard, weekend, special, a special price without a weekend price, run ends),
  the "From" price and label in English and Arabic (weekend, discounts, monthly, past and
  out-of-range runs ignored, equal prices not counted as a change, lists cached before the fields),
  setting, splitting, resetting, merging and clipping runs for nights and months, reading the form
  JSON (empty, valid, overlapping, past, malformed, too many, wrong period, bad prices and weekend
  prices), and the editor helpers.
- `src/components/special-prices.test.ts`: renders the editor and the public calendar to HTML. Each
  night's price and colour source, greyed past nights, month-name buttons, the list and the JSON sent
  (past runs dropped), the empty state, the "enter the standard price first" hint, the legend, the
  13-month grid for monthly rentals, switching period, Arabic, and prices on the property page's
  calendar (free vs booked nights, no prices when there's one price, monthly prices under the month
  name). Clicking through a selection needs a browser and isn't covered here.
- `src/lib/actions.test.ts` → "rental prices that change by date": saves both on edit and on
  publishing a new rental, both optional, weekend price range errors, monthly rentals keep months but
  no weekend price, sale listings and public submissions never keep them, malformed special prices
  refused without saving, past runs dropped and the current one started today.
- `src/lib/store.test.ts` → "weekend and special prices": reads (bigint as number, missing columns
  as none) and writes for nightly, monthly and sale listings.
- `src/lib/search.test.ts` → "applySearch with rental prices that change by date": filter and sort by
  the "From" price, back to the standard price once a special price is over.
