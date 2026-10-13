export const LISTING_TYPES = ["primary", "resale"] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

/**
 * Reads a listing type from a URL, form or row. "premium" was the old name of "primary"
 * (docs/listing-types.md), so old links, open forms and unmigrated rows keep working.
 */
export const toListingType = (v: unknown): ListingType | undefined =>
  v === "premium" ? "primary" : LISTING_TYPES.find((t) => t === v);

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

/**
 * A rental's special price for a run of nights ("YYYY-MM-DD" check-in days, nightly rentals) or months
 * ("YYYY-MM", monthly rentals), both ends included (docs/rental-pricing.md). On nightly rentals
 * `weekendPrice` is charged for the run's Thursday and Friday nights; null charges `price` every night.
 */
export type PriceRule = { from: string; to: string; price: number; weekendPrice: number | null };

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

/** Files a broker or owner can attach to a Primary submission (docs/primary-documents.md). */
export const DOCUMENT_KINDS = ["brochure", "paymentPlan"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export type PropertyDocument = {
  kind: DocumentKind;
  /** Vercel Blob URL. Unguessable, and only ever shown in the admin dashboard. */
  url: string;
  /** The file name as it was on the seller's device, for display. */
  name: string;
};

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
  /** Primary or resale. Chosen by the seller on /submit; the admin can change it. */
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
  /** 0 is the ground floor; null when not given (villas and houses usually have none). */
  floor: number | null;
  /** Rentals: the standard price per night or month, charged unless a weekend or special price applies. */
  price: number;
  /** Nightly rentals only: the price of Thursday and Friday nights; null charges the standard price. */
  weekendPrice: number | null;
  /** Rentals only: special prices for seasons and holidays, sorted and non-overlapping. Empty for sales. */
  priceRules: PriceRule[];
  /** The listing's description. On Primary listings it describes the project ("About the project"). */
  description: string;
  /** "About the developer", Primary sale listings only; "" otherwise (docs/developer-description.md). */
  developerDescription: string;
  features: string[];
  photos: string[];
  /** Private: the brochure and payment plan sent with a Primary submission. Admin-only. */
  documents: PropertyDocument[];
  /**
   * Rentals only: days already booked, as sorted "YYYY-MM-DD" Cairo days. Set by the admin on the
   * booking calendar and shown on the property page (docs/rental-calendar.md). Empty for sales.
   */
  bookedDates: string[];
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
