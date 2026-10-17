import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { CACHE_TAGS, PUBLIC_DATA_TTL } from "./cache-tags";
import { sql } from "./db";
import { HOST_EDITABLE } from "./host-accounts";
import { holdsEdits, type EditOutcome, type HostEdit, type PendingEdit } from "./listing-edits";
import { isCodeConflict } from "./property-codes";
import { toListingType, type Host, type Lead, type LeadStatus, type Location, type PriceRule, type Property, type PropertyDocument, type PropertyStatus } from "./types";

// Data layer backed by Postgres (schema in schema.sql).

const newId = () => crypto.randomUUID().slice(0, 8);

type Row = Record<string, unknown>;

const iso = (v: unknown) => (v as Date).toISOString();

const toProperty = (r: Row): Property => ({
  id: r.id as string,
  code: r.code as string | null,
  title: r.title as string,
  listingType: toListingType(r.listing_type) ?? "resale",
  featured: Boolean(r.featured),
  purpose: (r.purpose as Property["purpose"]) ?? "sale",
  rentPeriod: (r.rent_period as Property["rentPeriod"]) ?? null,
  type: r.type as Property["type"],
  location: r.location as string,
  // Joined from locations (see PROPERTY_SELECT); falls back to the id if the row is missing.
  locationName: { en: (r.location_en as string) ?? (r.location as string), ar: (r.location_ar as string) ?? (r.location as string) },
  compound: r.compound as string,
  area: r.area as number,
  bedrooms: r.bedrooms as number,
  bathrooms: r.bathrooms as number,
  floor: (r.floor as number | null) ?? null,
  price: Number(r.price),
  // bigint comes back as a string. Both columns read as "none" before schema.sql adds them.
  weekendPrice: r.weekend_price == null ? null : Number(r.weekend_price),
  priceRules: (r.price_rules as PriceRule[] | undefined) ?? [],
  description: r.description as string,
  developerDescription: (r.developer_description as string | undefined) ?? "",
  features: r.features as string[],
  photos: r.photos as string[],
  documents: (r.documents as PropertyDocument[] | undefined) ?? [],
  bookedDates: (r.booked_dates as string[] | undefined) ?? [],
  seller: {
    type: r.seller_type as Property["seller"]["type"],
    name: r.seller_name as string,
    phone: r.seller_phone as string,
    whatsapp: r.seller_whatsapp as string,
    company: r.seller_company as string,
  },
  // Reads as "no account" before schema.sql adds the column.
  hostId: (r.host_id as string | null | undefined) ?? null,
  // Read as "none" before schema.sql adds the columns.
  pendingEdit: (r.pending_edit as PendingEdit | null | undefined) ?? null,
  editOutcome: (r.edit_outcome as EditOutcome | null | undefined) ?? null,
  status: r.status as PropertyStatus,
  previousStatus: r.previous_status as PropertyStatus | null,
  adminNotes: r.admin_notes as string,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
});

const toLead = (r: Row): Lead => ({
  id: r.id as string,
  propertyId: r.property_id as string | null,
  propertyCode: r.property_code as string | null,
  propertyTitle: r.property_title as string | null,
  name: r.name as string,
  phone: r.phone as string,
  whatsapp: r.whatsapp as string,
  email: r.email as string,
  message: r.message as string,
  status: r.status as LeadStatus,
  notes: r.notes as string,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
});

const toLocation = (r: Row): Location => ({
  id: r.id as string,
  nameEn: r.name_en as string,
  nameAr: r.name_ar as string,
  cover: r.cover as string | null,
  archived: r.archived as boolean,
  createdAt: iso(r.created_at),
});

// ---- Properties ----

// Every property read joins its location names, so pages can label it without loading all locations.
const PROPERTY_SELECT = () => sql()`
  SELECT p.*, l.name_en AS location_en, l.name_ar AS location_ar
  FROM properties p LEFT JOIN locations l ON l.id = p.location`;

// cache(): the admin layout and page both need these lists; query once per request.
export const getProperties = cache(async () =>
  (await sql()`${PROPERTY_SELECT()} ORDER BY p.created_at DESC`).map(toProperty),
);

/**
 * Only published properties are visible on the public site. Cached across requests (see
 * docs/caching.md): every public page reads this one list, so page views don't hit the database.
 * Location names are joined in, so it is tagged with both properties and locations.
 */
export const getPublishedProperties = cache(
  unstable_cache(
    async () =>
      (await sql()`${PROPERTY_SELECT()} WHERE p.status = 'published' ORDER BY p.created_at DESC`).map(toProperty),
    ["published-properties"],
    { tags: [CACHE_TAGS.properties, CACHE_TAGS.locations], revalidate: PUBLIC_DATA_TTL },
  ),
);

/** A published property by its code, looked up in the cached list: unknown codes never reach the database. */
export async function getPublishedProperty(code: string) {
  return (await getPublishedProperties()).find((p) => p.code === code);
}

export async function getProperty(id: string) {
  const [row] = await sql()`${PROPERTY_SELECT()} WHERE p.id = ${id}`;
  return row ? toProperty(row) : undefined;
}

export type PropertyInput = Omit<
  Property,
  "id" | "code" | "locationName" | "hostId" | "pendingEdit" | "editOutcome" | "status" | "previousStatus" | "adminNotes" | "photos" | "documents" | "bookedDates" | "createdAt" | "updatedAt"
>;

const propertyColumns = (p: PropertyInput) => ({
  title: p.title,
  listing_type: p.listingType,
  featured: p.featured,
  purpose: p.purpose,
  rent_period: p.purpose === "rent" ? p.rentPeriod : null,
  type: p.type,
  location: p.location,
  compound: p.compound,
  area: p.area,
  bedrooms: p.bedrooms,
  bathrooms: p.bathrooms,
  floor: p.floor,
  price: p.price,
  // Weekend and special prices belong to rentals only (docs/rental-pricing.md).
  weekend_price: p.purpose === "rent" && p.rentPeriod === "night" ? p.weekendPrice : null,
  price_rules: sql().json(p.purpose === "rent" ? p.priceRules : []),
  description: p.description,
  developer_description: p.developerDescription,
  features: sql().json(p.features),
  seller_type: p.seller.type,
  seller_name: p.seller.name,
  seller_phone: p.seller.phone,
  seller_whatsapp: p.seller.whatsapp,
  seller_company: p.seller.company,
});

// Photos and documents are set on creation only; admin edits (updateProperty) keep them. `code` is
// the one the admin typed for a new rental (docs/rental-codes.md); without it the code is issued on
// publishing (setPropertyStatus). A taken code fails with the unique error (isCodeConflict).
// `hostId` is the account that sent it from /submit (docs/host-accounts.md); the column is only
// written when there is one, so the admin can still add properties before schema.sql adds it.
export async function createProperty(
  input: PropertyInput & { photos: string[]; documents?: PropertyDocument[]; code?: string | null; hostId?: string | null },
) {
  const row = {
    id: newId(),
    code: input.code ?? null,
    ...propertyColumns(input),
    photos: sql().json(input.photos),
    documents: sql().json(input.documents ?? []),
    ...(input.hostId && { host_id: input.hostId }),
  };
  await sql()`INSERT INTO properties ${sql()(row)}`;
  return row.id;
}

/** Whether any property, in any status, already has this code (codes are stored in capitals). */
export async function codeTaken(code: string) {
  return (await sql()`SELECT 1 FROM properties WHERE code = ${code}`).length > 0;
}

export async function updateProperty(id: string, patch: PropertyInput & { adminNotes: string }) {
  const row = { ...propertyColumns(patch), admin_notes: patch.adminNotes, updated_at: new Date() };
  await sql()`UPDATE properties SET ${sql()(row)} WHERE id = ${id}`;
}

// ---- Host edits (docs/host-edit-approval.md) ----

// The columns a host can change: the /submit fields and the photos. The admin's own settings (home
// page, purpose, rental prices, notes), the documents and the code are never touched.
const hostEditColumns = (e: HostEdit) => ({
  title: e.title,
  listing_type: e.listingType,
  type: e.type,
  location: e.location,
  compound: e.compound,
  area: e.area,
  bedrooms: e.bedrooms,
  bathrooms: e.bathrooms,
  floor: e.floor,
  price: e.price,
  description: e.description,
  developer_description: e.developerDescription,
  features: sql().json(e.features),
  seller_type: e.seller.type,
  seller_name: e.seller.name,
  seller_phone: e.seller.phone,
  seller_whatsapp: e.seller.whatsapp,
  seller_company: e.seller.company,
  photos: sql().json(e.photos),
});

/** Editable statuses where nothing is live yet, so a host's save changes the listing directly. */
const IN_PLACE_STATUSES = HOST_EDITABLE.filter((status) => !holdsEdits({ status }));

/**
 * A host's edit to a listing that isn't live yet (pending or needs changes): saved straight onto it,
 * and the listing goes (back) to review. Only matches the host's own sale listing in one of those
 * statuses, and says whether it did.
 */
export async function updateHostProperty(id: string, hostId: string, edit: HostEdit) {
  const rows = await sql()`
    UPDATE properties SET ${sql()({ ...hostEditColumns(edit), updated_at: new Date() })},
      previous_status = CASE WHEN status <> 'pending' THEN status ELSE previous_status END,
      status = 'pending',
      pending_edit = NULL,
      edit_outcome = NULL
    WHERE id = ${id} AND host_id = ${hostId} AND purpose = 'sale' AND status = ANY(${IN_PLACE_STATUSES})
    RETURNING id`;
  return rows.length > 0;
}

/**
 * A host's edit to their published listing, held for the admin. The live listing (and "Last
 * updated") stay as they are; a newer edit replaces a waiting one. Says whether it matched.
 */
export async function saveHostEdit(id: string, hostId: string, edit: PendingEdit) {
  const rows = await sql()`
    UPDATE properties SET pending_edit = ${sql().json(edit)}, edit_outcome = NULL
    WHERE id = ${id} AND host_id = ${hostId} AND purpose = 'sale' AND status = 'published'
    RETURNING id`;
  return rows.length > 0;
}

/**
 * The admin approves a waiting edit: its values become the listing's. Only applies the version the
 * admin looked at (`edit.submittedAt`), so a newer save by the host is never approved unseen.
 */
export async function approveHostEdit(id: string, edit: PendingEdit, outcome: EditOutcome) {
  const rows = await sql()`
    UPDATE properties SET ${sql()({ ...hostEditColumns(edit.values), updated_at: new Date() })},
      pending_edit = NULL,
      edit_outcome = ${sql().json(outcome)}
    WHERE id = ${id} AND pending_edit->>'submittedAt' = ${edit.submittedAt}
    RETURNING id`;
  return rows.length > 0;
}

/** The admin rejects a waiting edit: it is discarded and the listing stays as it was. */
export async function rejectHostEdit(id: string, submittedAt: string, outcome: EditOutcome) {
  const rows = await sql()`
    UPDATE properties SET pending_edit = NULL, edit_outcome = ${sql().json(outcome)}
    WHERE id = ${id} AND pending_edit->>'submittedAt' = ${submittedAt}
    RETURNING id`;
  return rows.length > 0;
}

/** How many sequence numbers setPropertyStatus tries before giving up on codes typed by the admin. */
const CODE_ATTEMPTS = 10;

export async function setPropertyStatus(id: string, status: PropertyStatus, adminNotes?: string) {
  // The code is issued on first approval, straight from a sequence, and never changes afterwards.
  // A rental code the admin typed may already use the next number (e.g. SKY-RES-0042): the unique
  // error is caught and the update retried. nextval is never rolled back, so each try gets the
  // next number. Rows that already have a code never conflict.
  for (let attempt = 1; ; attempt++) {
    try {
      return await issueCodeAndSetStatus(id, status, adminNotes);
    } catch (err) {
      if (attempt >= CODE_ATTEMPTS || !isCodeConflict(err)) throw err;
    }
  }
}

async function issueCodeAndSetStatus(id: string, status: PropertyStatus, adminNotes?: string) {
  // 'premium' is the old name of 'primary', for rows schema.sql hasn't migrated yet.
  await sql()`
    UPDATE properties SET
      previous_status = CASE WHEN status <> ${status} THEN status ELSE previous_status END,
      status = ${status},
      code = COALESCE(code, CASE
        WHEN ${status} <> 'published' THEN NULL
        WHEN purpose = 'rent' THEN 'SKY-RNT-' || lpad(nextval('property_code_rent')::text, 4, '0')
        WHEN listing_type IN ('primary', 'premium') THEN 'SKY-PRM-' || lpad(nextval('property_code_premium')::text, 4, '0')
        ELSE 'SKY-RES-' || lpad(nextval('property_code_resale')::text, 4, '0')
      END),
      admin_notes = COALESCE(${adminNotes ?? null}, admin_notes),
      updated_at = now()
    WHERE id = ${id}`;
}

/**
 * Replaces a rental's booked days (sorted "YYYY-MM-DD" strings, see availability.ts). Booking days
 * isn't a listing edit, so "Last updated" stays as it was.
 */
export async function setBookedDates(id: string, days: string[]) {
  await sql()`UPDATE properties SET booked_dates = ${sql().json(days)} WHERE id = ${id}`;
}

// ---- Locations ----

/** All locations, hidden ones included, alphabetical by English name. Cached across requests. */
export const getLocations = cache(
  unstable_cache(async () => (await sql()`SELECT * FROM locations ORDER BY name_en`).map(toLocation), ["locations"], {
    tags: [CACHE_TAGS.locations],
    revalidate: PUBLIC_DATA_TTL,
  }),
);

export async function getActiveLocations() {
  return (await getLocations()).filter((l) => !l.archived);
}

export async function createLocation(input: Pick<Location, "id" | "nameEn" | "nameAr" | "cover">) {
  await sql()`INSERT INTO locations ${sql()({ id: input.id, name_en: input.nameEn, name_ar: input.nameAr, cover: input.cover })}`;
}

/** `cover` undefined keeps the current photo. The id never changes. */
export async function updateLocation(id: string, patch: { nameEn: string; nameAr: string; cover?: string | null }) {
  const row = { name_en: patch.nameEn, name_ar: patch.nameAr, ...(patch.cover !== undefined && { cover: patch.cover }) };
  await sql()`UPDATE locations SET ${sql()(row)} WHERE id = ${id}`;
}

/** Locations are never deleted (properties reference them); hiding is reversible. */
export async function setLocationArchived(id: string, archived: boolean) {
  await sql()`UPDATE locations SET archived = ${archived} WHERE id = ${id}`;
}

// ---- Leads ----

export const getLeads = cache(async () =>
  (await sql()`SELECT * FROM leads ORDER BY created_at DESC`).map(toLead),
);

export async function createLead(input: Omit<Lead, "id" | "status" | "notes" | "createdAt" | "updatedAt">) {
  const row = {
    id: newId(),
    property_id: input.propertyId,
    property_code: input.propertyCode,
    property_title: input.propertyTitle,
    name: input.name,
    phone: input.phone,
    whatsapp: input.whatsapp,
    email: input.email,
    message: input.message,
  };
  await sql()`INSERT INTO leads ${sql()(row)}`;
}

export async function updateLead(id: string, patch: { status: LeadStatus; notes: string }) {
  await sql()`
    UPDATE leads SET status = ${patch.status}, notes = ${patch.notes}, updated_at = now()
    WHERE id = ${id}`;
}

// ---- Host accounts (docs/host-accounts.md) ----

const toHost = (r: Row): Host => ({
  id: r.id as string,
  username: r.username as string,
  sessionVersion: Number(r.session_version ?? 0),
  temporaryPassword: Boolean(r.password_temporary),
  createdAt: iso(r.created_at),
});

export async function getHost(id: string) {
  const [row] = await sql()`SELECT id, username, session_version, password_temporary, created_at FROM hosts WHERE id = ${id}`;
  return row ? toHost(row) : undefined;
}

/** An account with its password hash, for signing in. `username` must be normalized (lower case). */
export async function getHostLogin(username: string) {
  const [row] = await sql()`SELECT * FROM hosts WHERE username = ${username}`;
  return row ? { host: toHost(row), passwordHash: row.password_hash as string } : undefined;
}

/** Fails with the unique error (isUsernameConflict) when the username was taken in the meantime. */
export async function createHost(input: { username: string; passwordHash: string }) {
  const row = { id: newId(), username: input.username, password_hash: input.passwordHash };
  await sql()`INSERT INTO hosts ${sql()(row)}`;
  return row.id;
}

/**
 * Replaces a host's password and moves session_version on, which signs out every session the
 * account has. `temporary`: the admin set it, so /account asks the host to choose their own. Returns
 * the new session version (to keep the browser that changed it signed in), or undefined when the
 * account doesn't exist.
 */
export async function setHostPassword(id: string, passwordHash: string, temporary: boolean) {
  const [row] = await sql()`
    UPDATE hosts SET password_hash = ${passwordHash}, password_temporary = ${temporary}, session_version = session_version + 1
    WHERE id = ${id}
    RETURNING session_version`;
  return row ? Number(row.session_version) : undefined;
}

/** A host's listings in every status, newest first. */
export async function getHostProperties(hostId: string) {
  return (await sql()`${PROPERTY_SELECT()} WHERE p.host_id = ${hostId} ORDER BY p.created_at DESC`).map(toProperty);
}
