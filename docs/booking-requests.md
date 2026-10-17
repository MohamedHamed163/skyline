# Booking requests on WhatsApp

On a rental's property page, customers pick a check-in and a check-out day on the Availability
calendar, see the number of nights and the total price, and press **Ask on WhatsApp**. WhatsApp
opens a chat with Skyline's booking number (**0109 990 0149**) with a ready-made message asking
whether those dates are free.

Nothing is booked or saved by the site. Skyline replies on WhatsApp and, once the stay is agreed,
blocks the days on the admin booking calendar ([rental-calendar.md](rental-calendar.md)).

## Customer behaviour

On `/properties/[code]` for a rental, in the **Availability** section:

- The hint reads "Crossed-out days are already booked. Pick your check-in and check-out days, then
  ask Skyline on WhatsApp whether they're free."
- **First click** on a free day picks check-in. **Second click** on a later day picks check-out.
  While choosing check-out, hovering previews the stay. The check-in and check-out days are filled
  gold and the nights between them light gold ("Your stay" in the legend).
- A night is named by its check-in day, as everywhere else on the site
  ([rental-pricing.md](rental-pricing.md)), so a booked day means that night is taken.
  - Check-in can't be a booked day, a past day, or the calendar's last day (the night after it is
    beyond the calendar).
  - Check-out can be the **next booked day**: the guest leaves the day the next one arrives. Booked
    days further on can't be clicked. Clicking a free day beyond the next booked one starts a new
    stay from that day instead.
  - Clicking check-in again clears it. Clicking an earlier day starts again from that day. Once both
    days are picked, the next click starts a new stay.
- **The bar under the calendar** shows Check-in, Check-out, Nights and Total ("Pick a day" / "–"
  until they are known), a status line ("Pick your check-in day on the calendar." → "Now pick your
  check-out day." → "Send these dates to Skyline on WhatsApp to check they're free."), **Clear dates**
  once a day is picked, and the green **Ask on WhatsApp** button. The button is disabled until both
  days are picked, then opens WhatsApp in a new tab. <kbd>Esc</kbd> also clears the dates.
- Sale listings have no calendar and no button.

### The message

In the site's language. In English:

```
Hi, I'm interested in the following booking:
Property: SKY-RNT-0008 – Brand-new villa in Zayed Dunes
Check-in: Tue, 20 Oct 2026
Check-out: Fri, 20 Nov 2026
Total nights: 31
Total price: 279,700 EGP
Is it available on these dates?
```

The Arabic site sends the same lines in Arabic (`booking.message.*` in `src/lib/i18n/ar.ts`), with
dates in the site's Arabic date style.

### The total price

- **Nightly rentals**: the sum of each night's price, so weekend nights (Thursday and Friday) and
  special prices are included exactly as the calendar shows them.
- **Monthly rentals**: each whole month from check-in (20 Oct – 20 Nov, 20 Nov – 20 Dec, …) costs
  that month's price, taken from the month it starts in, so a season's special price applies to the
  months that start in it. Nights left over cost their share of the month they start (15 nights of
  the 30 from 20 Nov to 20 Dec = half its price). 31 January + 1 month is 28 (or 29) February. The
  total is rounded to the pound.

The total is the price the site works out for the customer's question. Skyline confirms the final
price in the WhatsApp reply.

## Changing the number

The booking number is `BOOKING_WHATSAPP` in `src/lib/booking.ts`. It is written in Egyptian local
form; `intlDigits` turns it into `201099900149` for the `wa.me` link. It is separate from
`NEXT_PUBLIC_SKYLINE_WHATSAPP`, which drives the general WhatsApp button under the request form.

## Data model

None. The stay lives in the browser while the customer picks it and is never sent to the server.

The property page passes the calendar only what it needs: `bookingRental(property)` picks the code,
title, purpose, rent period, price, weekend price and special prices. The calendar is a client
component, so whatever it is given is sent to the browser; passing the whole property would have
included the seller's private details.

## Code map

| File | Role |
| --- | --- |
| `src/lib/booking.ts` | Pure logic: `BOOKING_WHATSAPP`, `Rental` / `bookingRental`, `Stay`, `stayNights`, `lastCheckOut`, `canPick`, `pickDay`, `addMonthsToDay`, `stayTotal`, `bookingMessage`, `bookingHref`. |
| `src/components/availability-calendar.tsx` | `AvailabilityCalendar`: clickable days, stay highlighting and hover preview; `BookingSummary`: the bar with the totals and the WhatsApp button. |
| `src/app/(site)/properties/[code]/page.tsx` | Passes `bookingRental(property)` to the calendar. |
| `src/lib/format.ts` | `whatsappHref` and `intlDigits` build the `wa.me` link. |
| `src/lib/i18n/{en,ar}.ts` | `booking.*` (bar, legend, message) and `property.availabilityHint`. |

## Tests

- `src/lib/booking.test.ts`: only the safe fields reach the browser; nights of a stay; the latest
  check-out (next booked day or the calendar's end); which days can be clicked and what each click
  does (check-in, check-out, clearing, starting again, ending on a booked day, the calendar's last
  day); adding months to a day (short months, leap years); totals for nightly rentals (standard,
  weekend, special, no rent period) and monthly rentals (whole months, leftover nights, special
  months); the message in English and Arabic and the `wa.me` link.
- `src/components/availability-calendar.test.ts`: free days render as buttons and booked days as
  disabled ones, past days aren't clickable, and the bar in each state: nothing picked (button
  disabled, no link), check-in picked (Clear dates, still no link), both picked (nights, total and a
  WhatsApp link carrying the message), and Arabic. Clicking through a selection needs a browser and
  isn't covered here.
- `src/components/special-prices.test.ts` → "AvailabilityCalendar prices on the property page":
  prices on free nights still render with the clickable days.
