// Field rules shared by server actions and client forms, so both reject the same input.
export const validPhone = (phone: string) => /^\+?[\d\s()-]{8,20}$/.test(phone);

export const validEmail = (email: string) => /^\S+@\S+\.\S+$/.test(email);

// ---- Whole-number fields (price, area, rooms) ----

export type NumberLimits = { min: number; max: number };

/** Allowed ranges for the numeric property fields. Prices are in EGP, areas in m². */
export const PROPERTY_LIMITS = {
  price: { min: 1, max: 1_000_000_000 },
  area: { min: 1, max: 5_000 },
  bedrooms: { min: 0, max: 50 },
  bathrooms: { min: 0, max: 50 },
} as const satisfies Record<string, NumberLimits>;

export type NumberError = "required" | "notNumber" | "tooSmall" | "tooLarge";

/** Turns Arabic-Indic (٠١٢…) and Persian (۰۱۲…) digits into 0-9; other characters are kept. */
export const toLatinDigits = (s: string) =>
  s.replace(/[٠-٩۰-۹]/g, (c) => String(c.charCodeAt(0) % 16));

/** Keeps only the digits of `s` (after converting Arabic digits) and drops leading zeros. */
export const digitsOnly = (s: string) => toLatinDigits(s).replace(/\D/g, "").replace(/^0+(?=\d)/, "");

/** Longest digit string a field accepts, e.g. 10 for a max of 1,000,000,000. */
export const maxDigits = ({ max }: NumberLimits) => String(max).length;

/** Checks a raw field value against `limits`; null when it is valid. Empty is valid unless required. */
export function checkWholeNumber(raw: string, limits: NumberLimits, required = true): NumberError | null {
  const value = raw.trim();
  if (!value) return required ? "required" : null;
  if (!/^\d+$/.test(value)) return "notNumber";
  const n = Number(value);
  if (n < limits.min) return "tooSmall";
  if (n > limits.max) return "tooLarge";
  return null;
}

/** Groups digits with commas for display: "1000000" → "1,000,000". */
export const groupDigits = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** Index in `formatted` just after its `n`-th digit, used to keep the caret in place while typing. */
export function caretAfterDigits(formatted: string, n: number) {
  if (n <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]) && ++seen === n) return i + 1;
  }
  return formatted.length;
}

// ---- Text length limits ----

/** Maximum characters for the free-text property fields. */
export const TEXT_LIMITS = { title: 120, description: 2000 } as const;

export type CounterTone = "normal" | "near" | "full";

/** Colour state of a character counter: "near" from 90% of the limit, "full" at the limit. */
export function counterTone(length: number, max: number): CounterTone {
  if (length >= max) return "full";
  if (length >= max * 0.9) return "near";
  return "normal";
}
