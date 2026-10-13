// Booking calendar for rentals (docs/rental-calendar.md). Days are "YYYY-MM-DD" strings for
// calendar days in Cairo. Date maths runs in UTC, so neither the server's nor the browser's time
// zone can shift a day.

/** A calendar day, "YYYY-MM-DD". */
export type Day = string;
/** A calendar month, "YYYY-MM". */
export type Month = string;

/** How many months after the current one the calendar shows and accepts bookings for. */
export const MONTHS_AHEAD = 12;

const toDate = (day: Day) => new Date(`${day}T00:00:00Z`);
const toDay = (d: Date): Day => d.toISOString().slice(0, 10);

/** True for a real calendar day in "YYYY-MM-DD" form (2026-02-30 is not one). */
export const isDay = (v: unknown): v is Day =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(toDate(v).getTime()) && toDay(toDate(v)) === v;

export function addDays(day: Day, n: number): Day {
  const d = toDate(day);
  d.setUTCDate(d.getUTCDate() + n);
  return toDay(d);
}

export const monthOf = (day: Day): Month => day.slice(0, 7);

export function addMonths(month: Month, n: number): Month {
  const [y, m] = month.split("-").map(Number);
  return toDay(new Date(Date.UTC(y, m - 1 + n, 1))).slice(0, 7);
}

/** Today's date in Cairo, where every rental is. */
export function cairoToday(now = new Date()): Day {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** The last day that can be booked: the end of the month MONTHS_AHEAD after today's. */
export const lastBookableDay = (today: Day): Day => addDays(`${addMonths(monthOf(today), MONTHS_AHEAD + 1)}-01`, -1);

/** Every day from `a` to `b`, both included, in date order (the arguments may come in either order). */
export function daysBetween(a: Day, b: Day): Day[] {
  const [from, to] = a <= b ? [a, b] : [b, a];
  const days: Day[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

/**
 * The booked days after marking `from`–`to` booked (or available again). The range is clipped to
 * today … lastBookableDay, and days already past are dropped: nobody can book them any more.
 */
export function applyRange(booked: readonly Day[], from: Day, to: Day, isBooked: boolean, today: Day): Day[] {
  const [start, end] = from <= to ? [from, to] : [to, from];
  const last = lastBookableDay(today);
  const days = new Set(booked.filter((d) => d >= today));
  if (start <= last && end >= today) {
    for (const d of daysBetween(start < today ? today : start, end > last ? last : end)) {
      if (isBooked) days.add(d);
      else days.delete(d);
    }
  }
  return [...days].sort();
}

/** How many of the days from `from` to `to` are booked. */
export function bookedIn(booked: ReadonlySet<Day>, from: Day, to: Day) {
  return daysBetween(from, to).filter((d) => booked.has(d)).length;
}

/** Weeks start on Saturday in Arabic, as Egyptian calendars print them, and on Sunday in English. */
export const weekStartFor = (locale: string) => (locale === "ar" ? 6 : 0);

/**
 * The days of `month` laid out in weeks starting on `weekStart` (0 = Sunday … 6 = Saturday). Cells
 * before the 1st and after the last day are null, so the list fills whole weeks of 7.
 */
export function monthGrid(month: Month, weekStart: number): (Day | null)[] {
  const first = `${month}-01`;
  const lead = (toDate(first).getUTCDay() - weekStart + 7) % 7;
  const cells: (Day | null)[] = [...Array<null>(lead).fill(null), ...daysBetween(first, addDays(`${addMonths(month, 1)}-01`, -1))];
  while (cells.length % 7) cells.push(null);
  return cells;
}

/** The weekday (0 = Sunday … 6 = Saturday) of each column of a monthGrid. */
export const weekdayColumns = (weekStart: number) => Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7);
