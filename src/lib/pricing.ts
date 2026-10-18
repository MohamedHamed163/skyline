// Rental prices that change by date (docs/rental-pricing.md). Every rental is priced per night: a
// standard price, an optional weekend-night price and special prices for runs of nights. Nights are
// "YYYY-MM-DD" Cairo days named by their check-in day (see availability.ts). Special prices go as far
// ahead as the booking calendar: from today to the end of the month MONTHS_AHEAD from now.

import { addDays, addMonths, daysBetween, isDay, lastBookableDay, type Day, type Month } from "./availability";
import { formatPrice } from "./format";
import type { Dict } from "./i18n/en";
import { fmt } from "./i18n/shared";
import type { PriceRule, Property } from "./types";
import { PROPERTY_LIMITS } from "./validation";

/** Weekend nights, by check-in weekday (0 = Sunday): Thursday and Friday, Egypt's holiday-home weekend. */
export const WEEKEND_NIGHTS: readonly number[] = [4, 5];

export const isWeekendNight = (night: Day) => WEEKEND_NIGHTS.includes(new Date(`${night}T00:00:00Z`).getUTCDay());

/**
 * What a price depends on. weekendPrice and priceRules are optional because published lists cached
 * before they existed have neither (docs/caching.md); missing means none.
 */
export type Pricing = Pick<Property, "price" | "purpose"> & Partial<Pick<Property, "weekendPrice" | "priceRules">>;

/** Where a price comes from, for the calendar colours. */
export type PriceKind = "standard" | "weekend" | "special";
export type Quote = { price: number; kind: PriceKind };

const ruleFor = (rules: readonly PriceRule[] | undefined, key: string) => rules?.find((r) => r.from <= key && key <= r.to);

/** A night's price: a special price wins over the weekend price, which wins over the standard one. */
export function nightQuote(p: Pricing, night: Day): Quote {
  const weekend = isWeekendNight(night);
  const rule = ruleFor(p.priceRules, night);
  if (rule) return { price: weekend && rule.weekendPrice ? rule.weekendPrice : rule.price, kind: "special" };
  if (weekend && p.weekendPrice) return { price: p.weekendPrice, kind: "weekend" };
  return { price: p.price, kind: "standard" };
}

/** The lowest and highest price from today to the booking horizon. Sale listings have just one. */
export function priceSpan(p: Pricing, today: Day): { min: number; max: number } {
  if (p.purpose !== "rent" || (!p.weekendPrice && !p.priceRules?.length)) return { min: p.price, max: p.price };
  const prices = daysBetween(today, lastBookableDay(today)).map((d) => nightQuote(p, d).price);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/** True when a rental's price changes by date, so customers see "From …" and a price on each night. */
export function pricesVary(p: Pricing, today: Day) {
  const { min, max } = priceSpan(p, today);
  return min !== max;
}

/** The price search filters and sorts by: the lowest upcoming one, the same as the "From" price. */
export const listPrice = (p: Pricing, today: Day) => priceSpan(p, today).min;

/** "5,000 EGP / night", or "From 3,000 EGP / night" when the price changes by date. Sales show the plain price. */
export function priceLabel(t: Pick<Dict, "currency" | "perNight" | "rentFrom">, p: Pricing, today: Day) {
  const { min, max } = priceSpan(p, today);
  const price = formatPrice(min, t.currency);
  if (p.purpose !== "rent") return price;
  const text = `${price} ${t.perNight}`;
  return min === max ? text : fmt(t.rentFrom, { price: text });
}

// ---- Editing special prices ----

/**
 * Sorts non-overlapping rules, clips them to today … the booking horizon (dropping past ones) and
 * merges neighbours with the same prices, so the list stays short and tidy.
 */
export function tidyPriceRules(rules: readonly PriceRule[], today: Day): PriceRule[] {
  const [lo, hi] = [today, lastBookableDay(today)];
  const sorted = rules
    .map((r) => ({ ...r, from: r.from < lo ? lo : r.from, to: r.to > hi ? hi : r.to }))
    .filter((r) => r.from <= r.to)
    .sort((a, b) => a.from.localeCompare(b.from));
  const out: PriceRule[] = [];
  for (const r of sorted) {
    const prev = out.at(-1);
    if (prev && addDays(prev.to, 1) === r.from && prev.price === r.price && prev.weekendPrice === r.weekendPrice) out[out.length - 1] = { ...prev, to: r.to };
    else out.push(r);
  }
  return out;
}

/**
 * The special prices after giving `from`–`to` (either order) `price`, with `weekendPrice` for its
 * weekend nights, or after returning it to the standard price (`price` null). Whatever was set for
 * those nights before is replaced; the parts of other runs outside it are kept.
 */
export function setPriceRule(rules: readonly PriceRule[], from: Day, to: Day, price: number | null, weekendPrice: number | null, today: Day): PriceRule[] {
  const [start, end] = from <= to ? [from, to] : [to, from];
  const out: PriceRule[] = [];
  for (const r of rules) {
    if (r.to < start || r.from > end) {
      out.push(r);
      continue;
    }
    if (r.from < start) out.push({ ...r, to: addDays(start, -1) });
    if (r.to > end) out.push({ ...r, from: addDays(end, 1) });
  }
  if (price !== null) {
    // A weekend price equal to the price is no weekend price.
    out.push({ from: start, to: end, price, weekendPrice: weekendPrice !== price ? weekendPrice : null });
  }
  return tidyPriceRules(out, today);
}

/** Most special prices one rental can have: far more than its seasons and holidays need. */
export const MAX_PRICE_RULES = 100;

const validAmount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= PROPERTY_LIMITS.price.min && (v as number) <= PROPERTY_LIMITS.price.max;

/**
 * Reads the special prices the rental form sends as JSON. Returns null when anything is malformed,
 * so the save is refused rather than changing prices silently. Runs may overlap: later ones win, as
 * they do on the form. Past runs are dropped and the rest tidied (tidyPriceRules).
 */
export function readPriceRules(raw: string, today: Day): PriceRule[] | null {
  if (!raw.trim()) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(data) || data.length > MAX_PRICE_RULES) return null;
  let rules: PriceRule[] = [];
  for (const item of data) {
    if (typeof item !== "object" || item === null) return null;
    const { from, to, price, weekendPrice = null } = item as Record<string, unknown>;
    if (!isDay(from) || !isDay(to) || !validAmount(price)) return null;
    if (weekendPrice !== null && !validAmount(weekendPrice)) return null;
    rules = setPriceRule(rules, from, to, price, weekendPrice, today);
  }
  return rules;
}

/** The nights of `month` that can be priced (the whole month, clipped to today … the horizon), or null if none can. */
export function monthNights(month: Month, today: Day): [Day, Day] | null {
  const first = `${month}-01`;
  const last = addDays(`${addMonths(month, 1)}-01`, -1);
  const horizon = lastBookableDay(today);
  const from = first < today ? today : first;
  const to = last > horizon ? horizon : last;
  return from <= to ? [from, to] : null;
}

/** The special price that covers every night from `from` to `to`, if one does. */
export const ruleCovering = (rules: readonly PriceRule[], from: string, to: string) => rules.find((r) => r.from <= from && to <= r.to);

/** True when any night from `from` to `to` has a special price. */
export const hasRuleIn = (rules: readonly PriceRule[], from: string, to: string) => rules.some((r) => r.from <= to && r.to >= from);
