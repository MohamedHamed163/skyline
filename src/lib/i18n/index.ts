import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import ar from "./ar";
import en, { type Dict } from "./en";

export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = "lang";

export const dictionaries: Record<Locale, Dict> = { en, ar };

export const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale);

/** Current language, from the `lang` cookie (defaults to English). */
export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : "en";
});

export const getDict = async () => dictionaries[await getLocale()];

export { fmt } from "./shared";
export type { Dict };
