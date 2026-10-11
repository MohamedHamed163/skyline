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
