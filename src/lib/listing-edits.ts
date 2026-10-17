import type { Property, Seller } from "./types";

// Host edits waiting for the admin (docs/host-edit-approval.md). When a host edits a published
// listing, the new values are held in `pendingEdit` and the live listing stays as it was until the
// admin approves (applies) or rejects (discards) them. Pure, so the difference the admin sees can be
// unit tested.

/** What a host can change on their listing: the /submit fields plus the photos. */
export const HOST_EDIT_KEYS = [
  "title",
  "listingType",
  "type",
  "location",
  "compound",
  "area",
  "bedrooms",
  "bathrooms",
  "floor",
  "price",
  "description",
  "developerDescription",
  "features",
  "seller",
  "photos",
] as const;

export type HostEdit = Pick<Property, (typeof HOST_EDIT_KEYS)[number]>;

/** A host's edit held for review. `submittedAt` (ISO) identifies the version the admin looked at. */
export type PendingEdit = { values: HostEdit; submittedAt: string };

/** The admin's decision on the host's last edit, shown on /account until the next edit. */
export type EditOutcome = { result: "approved" | "rejected"; note: string; at: string };

/** Just the host-editable fields of a listing (or of parsed form values). */
export const pickHostEdit = (p: HostEdit): HostEdit => Object.fromEntries(HOST_EDIT_KEYS.map((k) => [k, p[k]])) as HostEdit;

/** Whether a host's save is held for the admin: only once the listing is live on the website. */
export const holdsEdits = (p: Pick<Property, "status">) => p.status === "published";

/**
 * The listing as the host last left it: the live values with their waiting edit on top. The edit
 * form starts from this, so a host can keep refining an edit that hasn't been approved yet.
 */
export const withPendingEdit = (p: Property): Property => (p.pendingEdit ? { ...p, ...p.pendingEdit.values } : p);

/** Rows of the side-by-side comparison, in form order. Seller details are split into their parts. */
export const DIFF_FIELDS = [
  "listingType",
  "title",
  "type",
  "location",
  "compound",
  "area",
  "bedrooms",
  "bathrooms",
  "floor",
  "price",
  "description",
  "developerDescription",
  "features",
  "sellerType",
  "sellerName",
  "sellerPhone",
  "sellerWhatsapp",
  "sellerCompany",
  "photos",
] as const;

export type DiffField = (typeof DIFF_FIELDS)[number];
export type FieldValue = string | number | string[] | null;
export type FieldChange = { field: DiffField; before: FieldValue; after: FieldValue };

type SellerField = "sellerType" | "sellerName" | "sellerPhone" | "sellerWhatsapp" | "sellerCompany";

const SELLER_PARTS: Record<SellerField, keyof Seller> = {
  sellerType: "type",
  sellerName: "name",
  sellerPhone: "phone",
  sellerWhatsapp: "whatsapp",
  sellerCompany: "company",
};

const isSellerField = (field: DiffField): field is SellerField => field in SELLER_PARTS;

export function fieldValue(p: HostEdit, field: DiffField): FieldValue {
  if (isSellerField(field)) return p.seller[SELLER_PARTS[field]];
  // Features are a set: the order they were ticked in doesn't matter.
  if (field === "features") return [...p.features].sort();
  return p[field] ?? null;
}

const same = (a: FieldValue, b: FieldValue) => JSON.stringify(a) === JSON.stringify(b);

/** The fields the edit changes, with their live and proposed values. Empty when nothing changed. */
export function diffEdit(live: HostEdit, edit: HostEdit): FieldChange[] {
  return DIFF_FIELDS.map((field) => ({ field, before: fieldValue(live, field), after: fieldValue(edit, field) })).filter((c) => !same(c.before, c.after));
}

/** Photos the edit adds and drops, for highlighting them in the comparison. */
export function photoChanges(before: string[], after: string[]) {
  return { added: after.filter((p) => !before.includes(p)), removed: before.filter((p) => !after.includes(p)) };
}
