# Rental booking calendar

Rentals have a booking calendar. The admin blocks the days that are already booked, and customers
see on the property page which days are still free before they send a request.

The calendar is informational. It doesn't take bookings or payments: customers still use "Request
More Information", and the admin confirms the dates and then blocks them.

## Admin behaviour

On a rental's admin page (`/admin/properties/[id]`, any status), a **Booking calendar** card sits
under the photos. It isn't shown for sale listings.

- Two months side by side (one on phones), from the current month up to 12 months ahead. The
  arrows page one month at a time.
- **Click a day** to select it, or **click a first and a last day** to select the range between
  them. While choosing the last day, hovering previews the range. A third click starts a new
  selection. **Cancel** or <kbd>Esc</kbd> clears it.
- The bar under the calendar names the selection ("Sun, 18 Oct 2026 – Thu, 22 Oct 2026 (5 days)")
  and offers **Mark booked** and **Mark available**. Mark booked is disabled when every selected day
  is already booked; Mark available when none is.
- Each change is saved straight away. The calendar updates at once and then shows the list the
  server saved. If saving fails, the change is undone and "Couldn't update the calendar. Please try
  again." appears under the calendar.
- Booked days are filled dark. Past days and days beyond the 12-month horizon are greyed out and
  can't be clicked. Today is underlined.
- The footer shows the number of booked days from today on ("Booked days ahead: 5"), or "Saving…"
  while a change is being saved.
- Booking days doesn't change the property's "Last updated" date; it isn't a listing edit.

## Customer behaviour

The property page of a rental (`/properties/SKY-RNT-…`) has an **Availability** section between
Features and Location:

- "Crossed-out days are already booked. Request the dates you want and Skyline will confirm them."
- The same two-month calendar, read-only. Free days are green, booked days grey and crossed out,
  today has a gold outline, and past days are dimmed. A legend sits underneath.
- Screen readers hear each day as "Tue, 13 Oct 2026, available" or "…, booked".
- When the rental's price changes by date, each free night also shows its price (or each month its
  price under the month name). See [rental-pricing.md](rental-pricing.md).
- Sale listings have no Availability section.

Weeks start on Sunday in English and on Saturday in Arabic, as Egyptian calendars print them. Arabic
weekday headings are single letters (ح ن ث ر خ ج س), since full names don't fit seven columns on a
phone. Month names and day numbers follow the site's date style (Western digits in Arabic too).

## Dates and time zones

A booked day is a calendar day in Cairo, stored as `"YYYY-MM-DD"`. "Today" is today in Cairo
(`cairoToday()`), computed on the server and passed to the calendars, so a visitor abroad and the
server's own time zone never shift a day. All date maths runs on UTC dates.

## Data model

`properties.booked_dates jsonb NOT NULL DEFAULT '[]'`: a sorted list of `"YYYY-MM-DD"` strings,
added in `src/lib/schema.sql`. Always `[]` for sale listings.

- Each save sends only the range and whether it is booked. The server reads the current list, applies
  the change (`applyRange`), drops days that are already past and stores the result. The list stays
  small: at most about 13 months of days.
- Ranges are clipped to today … the end of the month 12 months ahead (`lastBookableDay`).
- If an admin turns a rental into a sale listing, its booked days are kept but no longer shown.
- `Property.bookedDates` is part of the cached published list ([caching.md](caching.md)), so the
  property page reads it without an extra query. `setBookedDays` expires the `properties` tag, so
  a change shows on the public page straight away. The page uses `property.bookedDates ?? []`
  because cached entries from before this field have no `bookedDates` key.

**Deploy order:** run `npm run db:setup` against the database **before** deploying this code.
Saving the calendar writes the `booked_dates` column and fails ("Couldn't update the calendar")
until it exists. Reading is safe either way: a missing column reads as no booked days.

## Code map

| File | Role |
| --- | --- |
| `src/lib/availability.ts` | Pure date logic: `isDay`, `addDays`, `addMonths`, `cairoToday`, `lastBookableDay`, `daysBetween`, `applyRange`, `bookedIn`, `monthGrid`, `weekStartFor`, `MONTHS_AHEAD`. |
| `src/lib/format.ts` | `formatMonth`, `formatCalendarDay`, `weekdayLabel` for calendar days (formatted in UTC). |
| `src/lib/actions.ts` | `setBookedDays(id, from, to, booked)`: admin only, rentals only, validates the days, saves, expires the cache. Returns `{ ok: true, days }` or `{ ok: false, message }`. |
| `src/lib/store.ts` | Reads `booked_dates` into `bookedDates`; `setBookedDates(id, days)` writes it. |
| `src/lib/safe-action.ts` | `withFallback`: runs a server action and returns a fallback if the request fails. |
| `src/components/availability-calendar.tsx` | `CalendarMonths` (two-month pager, optional month `title` renderer), `CalendarLegend`, and the public read-only `AvailabilityCalendar` (with prices, see [rental-pricing.md](rental-pricing.md)). |
| `src/components/booking-calendar.tsx` | The admin `BookingCalendar`: selection, preview, Mark booked / available, saving and errors. |
| `src/app/admin/(panel)/properties/[id]/page.tsx` | Booking calendar card for rentals. |
| `src/app/(site)/properties/[code]/page.tsx` | Availability section for rentals. |
| `src/lib/i18n/{en,ar}.ts` | `calendar.*`, `admin.calendar.*`, `property.availability`, `property.availabilityHint`, `msg.calendarFailed`. |

## Tests

- `src/lib/availability.test.ts`: day validation, month and year rollover, Cairo "today", the
  12-month horizon, booking and freeing ranges (sorting, duplicates, past days, clipping),
  `bookedIn`, and month grids for Sunday- and Saturday-first weeks.
- `src/lib/format.test.ts` → "calendar formatting": month names, calendar days, weekday headings in
  both languages.
- `src/lib/actions.test.ts` → "setBookedDays": books and frees ranges, keeps other days, never books
  past days, rejects malformed days and non-rentals without saving, reports storage failures,
  requires an admin.
- `src/lib/cache-invalidation.test.ts`: changing booked days expires the `properties` tag.
- `src/lib/store.test.ts`: reads booked days (and `[]` when the column is missing); saves them as
  JSON without touching `updated_at`.
- `src/lib/safe-action.test.ts` → "withFallback".
