"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkPassword, endSession, isAdmin, startSession } from "./auth";
import { fmt, getDict, isLocale, LOCALE_COOKIE } from "./i18n";
import { uploadPhotos } from "./photos";
import * as store from "./store";
import {
  FEATURES,
  LEAD_STATUSES,
  LISTING_TYPES,
  LOCATIONS,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  PURPOSES,
  RENT_PERIODS,
  SELLER_TYPES,
  type FormState,
  type LeadStatus,
  type ListingType,
  type Location,
  type PropertyStatus,
  type PropertyType,
  type Purpose,
  type RentPeriod,
  type SellerType,
} from "./types";

const MAX_PHOTOS = 6;
const MAX_PHOTO_CHARS = 900_000; // ~650 KB per photo once base64-decoded

const text = (fd: FormData, key: string, max = 200) =>
  String(fd.get(key) ?? "").trim().slice(0, max);

const validPhone = (phone: string) => /^\+?[\d\s()-]{8,20}$/.test(phone);

// admin = true allows rentals and a "company" seller (no phone needed). Public submissions are sale-only.
async function parseProperty(fd: FormData, admin = false): Promise<{ error: string } | { data: store.PropertyInput }> {
  const t = (await getDict()).msg;
  const purpose = (admin ? (text(fd, "purpose") as Purpose) : "sale") satisfies Purpose;
  const rentPeriod = text(fd, "rentPeriod") as RentPeriod;
  const title = text(fd, "title", 120);
  const listingType = text(fd, "listingType") as ListingType;
  const type = text(fd, "type") as PropertyType;
  const location = text(fd, "location") as Location;
  const price = Number(fd.get("price"));
  const area = Number(fd.get("area"));
  const bedrooms = Number(fd.get("bedrooms"));
  const bathrooms = Number(fd.get("bathrooms"));
  const sellerType = text(fd, "sellerType") as SellerType;
  const sellerName = text(fd, "sellerName", 80);
  const sellerPhone = text(fd, "sellerPhone", 20);
  const sellerWhatsapp = text(fd, "sellerWhatsapp", 20);

  const company = admin && sellerType === "company";
  if (!title || (!sellerName && !company)) return { error: t.propertyMissing };
  if (
    !LISTING_TYPES.includes(listingType) ||
    !PROPERTY_TYPES.includes(type) ||
    !LOCATIONS.includes(location) ||
    !SELLER_TYPES.includes(sellerType) ||
    (!admin && sellerType === "company") ||
    !PURPOSES.includes(purpose) ||
    (purpose === "rent" && !RENT_PERIODS.includes(rentPeriod))
  ) {
    return { error: t.propertyChoices };
  }
  if (!(price > 0) || !(area > 0) || !(bedrooms >= 0) || !(bathrooms >= 0)) {
    return { error: t.positiveNumbers };
  }
  if (!validPhone(sellerPhone) && !(company && !sellerPhone)) return { error: t.badPhone };
  if (sellerWhatsapp && !validPhone(sellerWhatsapp)) {
    return { error: t.badWhatsapp };
  }

  return {
    data: {
      title,
      listingType,
      purpose,
      rentPeriod: purpose === "rent" ? rentPeriod : null,
      type,
      location,
      compound: text(fd, "compound", 80),
      area,
      bedrooms,
      bathrooms,
      price,
      description: text(fd, "description", 2000),
      features: fd.getAll("features").map(String).filter((f) => (FEATURES as readonly string[]).includes(f)),
      seller: {
        type: sellerType,
        name: sellerName || (company ? "Skyline" : ""),
        phone: sellerPhone,
        whatsapp: sellerWhatsapp,
        company: text(fd, "sellerCompany", 80),
      },
    },
  };
}

// ---- Broker / owner: submit a property for review ----

export async function submitProperty(_prev: FormState, fd: FormData): Promise<FormState> {
  const t = (await getDict()).msg;
  const parsed = await parseProperty(fd);
  if ("error" in parsed) return { ok: false, message: parsed.error };

  const photos = fd.getAll("photos").map(String);
  if (photos.length < 1 || photos.length > MAX_PHOTOS) {
    return { ok: false, message: fmt(t.photoCount, { max: MAX_PHOTOS }) };
  }
  if (photos.some((p) => !p.startsWith("data:image/jpeg;base64,") || p.length > MAX_PHOTO_CHARS)) {
    return { ok: false, message: t.photoFailed };
  }

  try {
    await store.createProperty({ ...parsed.data, photos: await uploadPhotos(photos) });
  } catch (err) {
    console.error("Property submission failed", err);
    return { ok: false, message: t.saveFailed };
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message: t.submitted };
}

// ---- Customer: request more information ----

export async function submitLead(_prev: FormState, fd: FormData): Promise<FormState> {
  const t = (await getDict()).msg;
  const propertyId = text(fd, "propertyId");
  const name = text(fd, "name", 80);
  const phone = text(fd, "phone", 20);
  const whatsapp = text(fd, "whatsapp", 20);
  const email = text(fd, "email", 120);

  // The property is attached by the page; the customer never types the code.
  const property = propertyId ? await store.getProperty(propertyId) : undefined;
  if (propertyId && (!property || property.status !== "published")) {
    return { ok: false, message: t.unavailable };
  }
  if (!name) return { ok: false, message: t.nameRequired };
  if (!validPhone(phone)) return { ok: false, message: t.badPhone };
  if (whatsapp && !validPhone(whatsapp)) return { ok: false, message: t.badWhatsapp };
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { ok: false, message: t.badEmail };

  await store.createLead({
    propertyId: property?.id ?? null,
    propertyCode: property?.code ?? null,
    propertyTitle: property?.title ?? null,
    name,
    phone,
    whatsapp,
    email,
    message: text(fd, "message", 1000),
  });
  revalidatePath("/admin", "layout");
  return { ok: true, message: t.leadThanks };
}

// ---- Admin ----

async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}

export async function adminLogin(_prev: FormState, fd: FormData): Promise<FormState> {
  const t = (await getDict()).msg;
  if (!process.env.ADMIN_PASSWORD) return { ok: false, message: t.adminNotConfigured };
  if (!checkPassword(String(fd.get("password") ?? ""))) return { ok: false, message: t.wrongPassword };
  await startSession();
  redirect("/admin");
}

export async function adminLogout() {
  await endSession();
  redirect("/admin/login");
}

export async function setPropertyStatus(id: string, status: PropertyStatus) {
  await requireAdmin();
  if (!PROPERTY_STATUSES.includes(status)) return;
  await store.setPropertyStatus(id, status);
  revalidatePath("/", "layout");
}

export async function requestChanges(id: string, fd: FormData) {
  await requireAdmin();
  await store.setPropertyStatus(id, "needs_changes", text(fd, "adminNotes", 2000));
  revalidatePath("/", "layout");
}

export async function updateProperty(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = await parseProperty(fd, true);
  if ("error" in parsed) return { ok: false, message: parsed.error };
  await store.updateProperty(id, { ...parsed.data, adminNotes: text(fd, "adminNotes", 2000) });
  revalidatePath("/", "layout");
  return { ok: true, message: (await getDict()).msg.saved };
}

export async function updateLead(id: string, fd: FormData) {
  await requireAdmin();
  const status = text(fd, "status") as LeadStatus;
  if (!LEAD_STATUSES.includes(status)) return;
  await store.updateLead(id, { status, notes: text(fd, "notes", 2000) });
  revalidatePath("/admin", "layout");
}

/** Admin-created listings (the only way to publish rentals): published immediately with a code. */
export async function createPropertyAdmin(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const t = (await getDict()).msg;
  const parsed = await parseProperty(fd, true);
  if ("error" in parsed) return { ok: false, message: parsed.error };
  const photos = fd.getAll("photos").map(String);
  if (photos.length < 1 || photos.length > MAX_PHOTOS) {
    return { ok: false, message: fmt(t.photoCount, { max: MAX_PHOTOS }) };
  }
  if (photos.some((p) => !p.startsWith("data:image/jpeg;base64,") || p.length > MAX_PHOTO_CHARS)) {
    return { ok: false, message: t.photoFailed };
  }
  let id: string;
  try {
    id = await store.createProperty({ ...parsed.data, photos: await uploadPhotos(photos) });
    await store.setPropertyStatus(id, "published");
  } catch (err) {
    console.error("Admin property creation failed", err);
    return { ok: false, message: t.saveFailed };
  }
  revalidatePath("/", "layout");
  redirect(`/admin/properties/${id}`);
}

// ---- Language ----

export async function setLocale(fd: FormData) {
  const locale = fd.get("locale");
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
