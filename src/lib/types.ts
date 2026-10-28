import type { EditOutcome, PendingEdit } from "./listing-edits";

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
  /** Its areas (docs/sub-locations.md), hidden ones included, in display order. Empty for most regions. */
  subLocations: SubLocation[];
};

/**
 * An area inside a location (New Cairo → Fifth Settlement), managed on /admin/locations. `id` is
 * "<location id>--<slug>", so it is unique across locations and never changes.
 */
export type SubLocation = {
  id: string;
  locationId: string;
  nameEn: string;
  nameAr: string;
  /** Lower comes first; ties are alphabetical by English name. */
  sortOrder: number;
  /** Hidden: kept on its properties but not offered in the forms or filters. */
  archived: boolean;
};

/** A location's display names, joined onto each property so pages don't need the location list. */
export type LocationName = { en: string; ar: string };

export const PURPOSES = ["sale", "rent"] as const;
export type Purpose = (typeof PURPOSES)[number];

/**
 * A rental's special price for a run of nights ("YYYY-MM-DD" check-in days), both ends included
 * (docs/rental-pricing.md). `weekendPrice` is charged for the run's Thursday, Friday and Saturday nights; null
 * charges `price` every night.
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

/** Every lead starts as "new"; the admin can only move it to the other two (docs/lead-statuses.md). */
export const LEAD_STATUSES = ["new", "contacted", "not_interested"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
/** The choices in a lead's status dropdown. */
export const SETTABLE_LEAD_STATUSES = ["contacted", "not_interested"] as const satisfies readonly LeadStatus[];

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
  /**
   * Skyline Property Code, e.g. SKY-RES-0001. Sales get theirs on first approval; rentals the one the
   * admin typed when adding them (docs/rental-codes.md). Never changed.
   */
  code: string | null;
  title: string;
  /** Primary or resale. Chosen by the seller on /submit; the admin can change it. */
  listingType: ListingType;
  /** Admin-picked: shown first in its home-page section (and its compound first in Featured projects). */
  featured: boolean;
  /** Rentals are created by the admin only and priced per night; public submissions are always "sale". */
  purpose: Purpose;
  type: PropertyType;
  /** Location id (slug). */
  location: string;
  locationName: LocationName;
  /** Sub-location id picked from the list, or null (docs/sub-locations.md). */
  subLocation: string | null;
  /** Its names, joined like locationName; null without one. */
  subLocationName: LocationName | null;
  /** A sub-location typed by the host or admin because it isn't in the list; "" otherwise. Never set with subLocation. */
  subLocationCustom: string;
  compound: string;
  area: number;
  bedrooms: number;
  bathrooms: number;
  /** 0 is the ground floor; null when not given (villas and houses usually have none). */
  floor: number | null;
  /**
   * Primary sale listings describe a project's units as ranges: area, bedrooms, bathrooms, floor and
   * price above are the "from" values and these the "to" values (docs/unit-ranges.md). null when
   * every unit has the same value, and always null on Resale listings and rentals.
   */
  areaMax: number | null;
  bedroomsMax: number | null;
  bathroomsMax: number | null;
  floorMax: number | null;
  priceMax: number | null;
  /** Rentals: the standard price per night or month, charged unless a weekend or special price applies. */
  price: number;
  /** Nightly rentals only: the price of Thursday, Friday and Saturday nights; null charges the standard price. */
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
  /**
   * The host account that listed it on /submit (docs/host-accounts.md). null for properties the
   * admin added and for those sent before accounts existed.
   */
  hostId: string | null;
  /**
   * A host's edit to the published listing, waiting for the admin; the live fields above are
   * unchanged until it is approved (docs/host-edit-approval.md). null when there is none.
   */
  pendingEdit: PendingEdit | null;
  /** The admin's decision on the host's last edit, for /account. null before any decision. */
  editOutcome: EditOutcome | null;
  status: PropertyStatus;
  previousStatus: PropertyStatus | null;
  /** Internal admin notes (e.g. what must change before approval). */
  adminNotes: string;
  createdAt: string;
  updatedAt: string;
};

/** A broker or owner's account (docs/host-accounts.md). The password hash never leaves store.ts. */
export type Host = {
  id: string;
  /** Lower case, unique. */
  username: string;
  /** Signed into the session cookie; a password change moves it on, signing out other sessions. */
  sessionVersion: number;
  /** The admin set this password for the host, who should choose their own. */
  temporaryPassword: boolean;
  createdAt: string;
};

/** A host account as the admin's Accounts page lists it (docs/password-help.md). */
export type HostSummary = Host & {
  /** Every listing the account sent, in any status. */
  listings: number;
  /** The seller phone numbers on those listings, to check a caller is the account's owner. */
  phones: string[];
};

/** "I forgot my password", sent from the sign-in form (docs/password-help.md). */
export type PasswordRequest = {
  id: string;
  /** As typed, normalized like a username. */
  username: string;
  /** The account with that username, or null when there is none. */
  hostId: string | null;
  /** Where the host asked to be contacted. */
  phone: string;
  createdAt: string;
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
