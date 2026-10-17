// Booking requests on a rental's property page (docs/booking-requests.md). The customer picks a
// check-in and a check-out day on the Availability calendar, sees the nights (and the total price on
// nightly rentals) and sends Skyline a ready-made WhatsApp message asking whether those dates are
// free. Nothing is booked or saved here: Skyline replies, then blocks the days on the admin calendar.

import { addDays, daysBetween, lastBookableDay, type Day } from "./availability";
import { formatCalendarDay, formatPrice, whatsappHref } from "./format";
import type { Dict } from "./i18n/en";
import { fmt } from "./i18n/shared";
import { nightQuote, type Pricing } from "./pricing";
import type { Property } from "./types";

/** Skyline's WhatsApp number for booking requests. */
export const BOOKING_WHATSAPP = "0109 990 0149";

/**
 * What the property page sends to the calendar in the browser: the price fields and the code and
 * title for the message. Picked one by one so the seller's details never leave the server.
 */
export type Rental = Pricing & Pick<Property, "code" | "title">;

export const bookingRental = (p: Property): Rental => ({
  code: p.code,
  title: p.title,
  purpose: p.purpose,
  rentPeriod: p.rentPeriod,
  price: p.price,
  weekendPrice: p.weekendPrice,
  priceRules: p.priceRules,
});

/** A stay: the day the guest arrives and the day they leave. `checkOut` is null while it is being picked. */
export type Stay = { checkIn: Day; checkOut: Day | null };

/** The nights of a stay, each named by its check-in day: from check-in to the night before check-out. */
export const stayNights = (checkIn: Day, checkOut: Day): Day[] => (checkOut > checkIn ? daysBetween(checkIn, addDays(checkOut, -1)) : []);

/**
 * The latest check-out for a stay arriving on `checkIn`: the next booked day (a guest can leave the
 * day the next one arrives), or the last day of the calendar when nothing after it is booked.
 */
export function lastCheckOut(booked: ReadonlySet<Day>, checkIn: Day, today: Day): Day {
  let last = lastBookableDay(today);
  for (const d of booked) if (d > checkIn && d < last) last = d;
  return last;
}

/** True when `day` can be clicked: a free check-in day, or a check-out for the stay being picked. */
export function canPick(stay: Stay | null, day: Day, booked: ReadonlySet<Day>, today: Day): boolean {
  if (stay && !stay.checkOut && day > stay.checkIn && day <= lastCheckOut(booked, stay.checkIn, today)) return true;
  // The calendar's last day can only be a check-out: the night after it is beyond the calendar.
  return day >= today && day < lastBookableDay(today) && !booked.has(day);
}

/**
 * The stay after clicking `day` (one canPick allows). The first click picks check-in, the second
 * check-out. Clicking check-in again clears it; clicking an earlier day, a day past the next booked
 * one, or any day once the stay is complete starts again from that day.
 */
export function pickDay(stay: Stay | null, day: Day, booked: ReadonlySet<Day>, today: Day): Stay | null {
  if (stay && !stay.checkOut) {
    if (day === stay.checkIn) return null;
    if (day > stay.checkIn && day <= lastCheckOut(booked, stay.checkIn, today)) return { checkIn: stay.checkIn, checkOut: day };
  }
  return { checkIn: day, checkOut: null };
}

/**
 * What a stay costs: each night's price added up, weekend and special prices included. Monthly
 * rentals have no total (null): the bar and the message leave it out and Skyline quotes the stay.
 */
export function stayTotal(p: Pricing, checkIn: Day, checkOut: Day): number | null {
  if (p.rentPeriod === "month") return null;
  return stayNights(checkIn, checkOut).reduce((sum, night) => sum + nightQuote(p, night).price, 0);
}

/** The WhatsApp message asking Skyline whether a stay is free, in the site's language. */
export function bookingMessage(t: Pick<Dict, "booking" | "currency" | "locale">, rental: Rental, checkIn: Day, checkOut: Day) {
  const m = t.booking.message;
  const total = stayTotal(rental, checkIn, checkOut);
  return [
    m.greeting,
    fmt(m.property, { code: rental.code ?? "", title: rental.title }),
    fmt(m.checkIn, { day: formatCalendarDay(checkIn, t.locale) }),
    fmt(m.checkOut, { day: formatCalendarDay(checkOut, t.locale) }),
    fmt(m.nights, { n: stayNights(checkIn, checkOut).length }),
    ...(total === null ? [] : [fmt(m.total, { price: formatPrice(total, t.currency) })]),
    m.question,
  ].join("\n");
}

/** Opens a WhatsApp chat with Skyline, the booking message already typed. */
export const bookingHref = (t: Pick<Dict, "booking" | "currency" | "locale">, rental: Rental, checkIn: Day, checkOut: Day) =>
  whatsappHref(BOOKING_WHATSAPP, bookingMessage(t, rental, checkIn, checkOut));
