import "server-only";
import { cache } from "react";
import { sql } from "./db";
import type { Lead, LeadStatus, Property, PropertyStatus } from "./types";

// Data layer backed by Postgres (schema in schema.sql).

const newId = () => crypto.randomUUID().slice(0, 8);

type Row = Record<string, unknown>;

const iso = (v: unknown) => (v as Date).toISOString();

const toProperty = (r: Row): Property => ({
  id: r.id as string,
  code: r.code as string | null,
  title: r.title as string,
  listingType: r.listing_type as Property["listingType"],
  purpose: (r.purpose as Property["purpose"]) ?? "sale",
  rentPeriod: (r.rent_period as Property["rentPeriod"]) ?? null,
  type: r.type as Property["type"],
  location: r.location as Property["location"],
  compound: r.compound as string,
  area: r.area as number,
  bedrooms: r.bedrooms as number,
  bathrooms: r.bathrooms as number,
  price: Number(r.price),
  description: r.description as string,
  features: r.features as string[],
  photos: r.photos as string[],
  seller: {
    type: r.seller_type as Property["seller"]["type"],
    name: r.seller_name as string,
    phone: r.seller_phone as string,
    whatsapp: r.seller_whatsapp as string,
    company: r.seller_company as string,
  },
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

// ---- Properties ----

// cache(): the admin layout and page both need these lists; query once per request.
export const getProperties = cache(async () =>
  (await sql()`SELECT * FROM properties ORDER BY created_at DESC`).map(toProperty),
);

/** Only published properties are visible on the public site. */
export async function getPublishedProperties() {
  const rows = await sql()`SELECT * FROM properties WHERE status = 'published' ORDER BY created_at DESC`;
  return rows.map(toProperty);
}

export async function getProperty(id: string) {
  const [row] = await sql()`SELECT * FROM properties WHERE id = ${id}`;
  return row ? toProperty(row) : undefined;
}

export async function getPropertyByCode(code: string) {
  const [row] = await sql()`SELECT * FROM properties WHERE code = ${code}`;
  return row ? toProperty(row) : undefined;
}

export type PropertyInput = Omit<
  Property,
  "id" | "code" | "status" | "previousStatus" | "adminNotes" | "photos" | "createdAt" | "updatedAt"
>;

const propertyColumns = (p: PropertyInput) => ({
  title: p.title,
  listing_type: p.listingType,
  purpose: p.purpose,
  rent_period: p.purpose === "rent" ? p.rentPeriod : null,
  type: p.type,
  location: p.location,
  compound: p.compound,
  area: p.area,
  bedrooms: p.bedrooms,
  bathrooms: p.bathrooms,
  price: p.price,
  description: p.description,
  features: sql().json(p.features),
  seller_type: p.seller.type,
  seller_name: p.seller.name,
  seller_phone: p.seller.phone,
  seller_whatsapp: p.seller.whatsapp,
  seller_company: p.seller.company,
});

export async function createProperty(input: PropertyInput & { photos: string[] }) {
  const row = { id: newId(), ...propertyColumns(input), photos: sql().json(input.photos) };
  await sql()`INSERT INTO properties ${sql()(row)}`;
  return row.id;
}

export async function updateProperty(id: string, patch: PropertyInput & { adminNotes: string }) {
  const row = { ...propertyColumns(patch), admin_notes: patch.adminNotes, updated_at: new Date() };
  await sql()`UPDATE properties SET ${sql()(row)} WHERE id = ${id}`;
}

export async function setPropertyStatus(id: string, status: PropertyStatus, adminNotes?: string) {
  // The code is issued on first approval, straight from a sequence, and never changes afterwards.
  await sql()`
    UPDATE properties SET
      previous_status = CASE WHEN status <> ${status} THEN status ELSE previous_status END,
      status = ${status},
      code = COALESCE(code, CASE
        WHEN ${status} <> 'published' THEN NULL
        WHEN purpose = 'rent' THEN 'SKY-RNT-' || lpad(nextval('property_code_rent')::text, 4, '0')
        WHEN listing_type = 'premium' THEN 'SKY-PRM-' || lpad(nextval('property_code_premium')::text, 4, '0')
        ELSE 'SKY-RES-' || lpad(nextval('property_code_resale')::text, 4, '0')
      END),
      admin_notes = COALESCE(${adminNotes ?? null}, admin_notes),
      updated_at = now()
    WHERE id = ${id}`;
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
