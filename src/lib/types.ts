export const LISTING_TYPES = ["premium", "resale"] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

export const PROPERTY_TYPES = [
  "apartment",
  "villa",
  "chalet",
  "townhouse",
  "twin_house",
  "duplex",
  "penthouse",
  "other",
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

/**
 * A place properties are listed in (e.g. New Cairo). Managed by the admin at /admin/locations.
 * `id` is a URL slug made from the English name on creation and never changes, so renaming keeps
 * every property and search link working.
 */
export type Location = {
  id: string;
  nameEn: string;
  nameAr: string;
  /** Home-page cover photo URL; null falls back to a default image. */
  cover: string | null;
  /** Hidden locations are kept for existing properties but can't be picked for new ones or searched. */
  archived: boolean;
  createdAt: string;
};

/** A location's display names, joined onto each property so pages don't need the location list. */
export type LocationName = { en: string; ar: string };

export const PURPOSES = ["sale", "rent"] as const;
export type Purpose = (typeof PURPOSES)[number];

export const RENT_PERIODS = ["night", "month"] as const;
export type RentPeriod = (typeof RENT_PERIODS)[number];

export const PROPERTY_STATUSES = [
  "pending",
  "published",
  "needs_changes",
  "rejected",
  "reserved",
  "sold",
  "archived",
] as const;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

export const SELLER_TYPES = ["broker", "owner", "company"] as const;
export type SellerType = (typeof SELLER_TYPES)[number];

export const FEATURES = [
  "Garden",
  "Private pool",
  "Parking",
  "Sea view",
  "Balcony",
  "Elevator",
  "Security",
  "Furnished",
  "Fully finished",
] as const;

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "interested",
  "viewing_scheduled",
  "negotiating",
  "closed",
  "not_interested",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type Seller = {
  type: SellerType;
  name: string;
  phone: string;
  whatsapp: string;
  company: string;
};

export type Property = {
  id: string;
  /** Skyline Property Code, e.g. SKY-RES-0001. Assigned on first approval and never changed. */
  code: string | null;
  title: string;
  /** Premium or resale. Set by the admin; public submissions arrive as resale. */
  listingType: ListingType;
  /** Admin-picked: shown first in its home-page section (and its compound first in Featured projects). */
  featured: boolean;
  /** Rentals are created by the admin only; public submissions are always "sale". */
  purpose: Purpose;
  /** Price basis for rentals (null for sale). */
  rentPeriod: RentPeriod | null;
  type: PropertyType;
  /** Location id (slug). */
  location: string;
  locationName: LocationName;
  compound: string;
  area: number;
  bedrooms: number;
  bathrooms: number;
  price: number;
  description: string;
  features: string[];
  photos: string[];
  /** Private: never rendered on public pages. */
  seller: Seller;
  status: PropertyStatus;
  previousStatus: PropertyStatus | null;
  /** Internal admin notes (e.g. what must change before approval). */
  adminNotes: string;
  createdAt: string;
  updatedAt: string;
};

export type Lead = {
  id: string;
  /** null for general inquiries sent from the contact page. */
  propertyId: string | null;
  propertyCode: string | null;
  propertyTitle: string | null;
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  message: string;
  status: LeadStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type FormState = { ok: boolean; message: string } | null;
