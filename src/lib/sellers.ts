import type { Seller, SellerType } from "./types";

// Seller labels for the admin. Pure, so it is unit-tested without the dictionary or database.

/** Saved as the seller name when the admin lists a property as Skyline and leaves the name empty. */
export const COMPANY_DEFAULT_NAME = "Skyline";

type Labels = { siteName: string; seller: Record<SellerType, string> };

/** Company listings with the default name show the site name in the current language (سكاي لاين). */
export function sellerName(t: Labels, s: Pick<Seller, "type" | "name">) {
  return s.type === "company" && (!s.name || s.name === COMPANY_DEFAULT_NAME) ? t.siteName : s.name;
}

/** "Name (Broker)". Skyline's own listings show just the name, which already says who it is. */
export function sellerWithType(t: Labels, s: Pick<Seller, "type" | "name">) {
  return s.type === "company" ? sellerName(t, s) : `${s.name} (${t.seller[s.type]})`;
}
