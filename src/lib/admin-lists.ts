import type { ListingType, Property, Purpose } from "./types";

/**
 * Which listing section a property belongs to in the admin sidebar (docs/admin-listing-sections.md).
 * Rentals still store a listing type, but Primary and Resale only ever hold sales.
 */
export type ListingSection = ListingType | "rent";

export const listingSection = (p: Pick<Property, "purpose" | "listingType">): ListingSection =>
  p.purpose === "rent" ? "rent" : p.listingType;

/**
 * Whether a property passes the admin list's Sale/Rent and Primary/Resale filters. A listing type
 * means sales only; combined with Rent (two filters that can't both hold) the listing type is ignored.
 */
export function matchesListing(p: Pick<Property, "purpose" | "listingType">, purpose?: Purpose, listing?: ListingType) {
  if (purpose === "rent") return p.purpose === "rent";
  if (listing) return listingSection(p) === listing;
  return !purpose || p.purpose === purpose;
}
