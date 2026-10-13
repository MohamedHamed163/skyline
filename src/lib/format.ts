import type { Dict } from "./i18n/en";
import { fmt } from "./i18n/shared";

export const CURRENCY = "EGP";

export function formatPrice(price: number, currency = CURRENCY) {
  return `${new Intl.NumberFormat("en-US").format(price)} ${currency}`;
}

/** "Ground floor" for 0, otherwise "Floor 3". */
export function floorText(t: Pick<Dict, "floorN" | "groundFloor">, floor: number) {
  return floor === 0 ? t.groundFloor : fmt(t.floorN, { n: floor });
}

const CAIRO = "Africa/Cairo";
// Arabic dates with Western digits, which is what most Egyptian sites use.
const dateLocale = (locale: string) => (locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB");

export function formatDate(iso: string, locale = "en") {
  return new Intl.DateTimeFormat(dateLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CAIRO,
  }).format(new Date(iso));
}

export function formatDay(iso: string, locale = "en") {
  return new Intl.DateTimeFormat(dateLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: CAIRO,
  }).format(new Date(iso));
}

// Calendar days ("YYYY-MM-DD", see availability.ts) are already Cairo days: format them in UTC so
// the viewer's time zone can't move them.
const calendarDate = (day: string) => new Date(`${day}T00:00:00Z`);

/** "October 2026" for a "YYYY-MM" month. */
export function formatMonth(month: string, locale = "en") {
  return new Intl.DateTimeFormat(dateLocale(locale), { month: "long", year: "numeric", timeZone: "UTC" }).format(calendarDate(`${month}-01`));
}

/** "Tue, 13 Oct 2026" for a "YYYY-MM-DD" day. */
export function formatCalendarDay(day: string, locale = "en") {
  return new Intl.DateTimeFormat(dateLocale(locale), { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(calendarDate(day));
}

/** Calendar column heading for a weekday (0 = Sunday): "Sun" in English, "ح" in Arabic, where full names don't fit. */
export function weekdayLabel(weekday: number, locale = "en") {
  // 4 January 2026 was a Sunday.
  const day = `2026-01-${String(4 + weekday).padStart(2, "0")}`;
  return new Intl.DateTimeFormat(dateLocale(locale), { weekday: locale === "ar" ? "narrow" : "short", timeZone: "UTC" }).format(calendarDate(day));
}

export function isToday(iso: string) {
  return formatDay(iso) === formatDay(new Date().toISOString());
}

/** Digits only, in international form. Local Egyptian numbers (01x…) get the 20 country code. */
export function intlDigits(phone: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `20${digits.slice(1)}`;
  return digits;
}

export const telHref = (phone: string) => `tel:+${intlDigits(phone)}`;

export const whatsappHref = (phone: string, text?: string) =>
  `https://wa.me/${intlDigits(phone)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
