"use server";

import { revalidatePath, updateTag } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkPassword, endSession, isAdmin, startSession } from "./auth";
import { applyRange, cairoToday, isDay } from "./availability";
import { CACHE_TAGS } from "./cache-tags";
import { readDocuments } from "./document-limits";
import { verifyDocument } from "./documents";
import { fmt, getDict, isLocale, LOCALE_COOKIE } from "./i18n";
import { MAX_LOCATION_NAME, slugify, uniqueSlug, validateLocation } from "./locations";
import { uploadPhotos } from "./photos";
import { clientIp, LIMITS, limiter } from "./rate-limit";
import { COMPANY_DEFAULT_NAME } from "./sellers";
import * as store from "./store";
import { checkWholeNumber, groupDigits, PROPERTY_LIMITS, TEXT_LIMITS, validEmail, validPhone } from "./validation";
import {
  FEATURES,
  LEAD_STATUSES,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  PURPOSES,
  RENT_PERIODS,
  SELLER_TYPES,
  toListingType,
  type FormState,
  type LeadStatus,
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

// admin = true allows rentals, a "company" seller (no phone needed) and "show on home page". Public
// submissions are sale-only and never featured; the seller picks primary or resale.
async function parseProperty(fd: FormData, admin = false): Promise<{ error: string } | { data: store.PropertyInput }> {
  const dict = await getDict();
  const t = dict.msg;
  const purpose = (admin ? (text(fd, "purpose") as Purpose) : "sale") satisfies Purpose;
  const rentPeriod = text(fd, "rentPeriod") as RentPeriod;
  const title = text(fd, "title", TEXT_LIMITS.title);
  // A public form opened before sellers could choose sends no listing type: it arrives as resale.
  const listingType = toListingType(text(fd, "listingType") || (admin ? "" : "resale"));
  const type = text(fd, "type") as PropertyType;
  const location = text(fd, "location");
  const sellerType = text(fd, "sellerType") as SellerType;
  const sellerName = text(fd, "sellerName", 80);
  const sellerPhone = text(fd, "sellerPhone", 20);
  const sellerWhatsapp = text(fd, "sellerWhatsapp", 20);

  const company = admin && sellerType === "company";
  // Public submissions need a visible location; the admin may keep a property on a hidden one.
  const place = (await store.getLocations()).find((l) => l.id === location);
  const validLocation = Boolean(place && (admin || !place.archived));
  if (!title || (!sellerName && !company)) return { error: t.propertyMissing };
  // Over-long text is rejected, not silently cut off (the form's counters stop it at the limit).
  for (const key of ["title", "description"] as const) {
    if (String(fd.get(key) ?? "").trim().length > TEXT_LIMITS[key]) {
      return { error: fmt(t.textTooLong, { field: dict.fields[key], max: groupDigits(String(TEXT_LIMITS[key])) }) };
    }
  }
  if (
    !listingType ||
    !PROPERTY_TYPES.includes(type) ||
    !validLocation ||
    !SELLER_TYPES.includes(sellerType) ||
    (!admin && sellerType === "company") ||
    !PURPOSES.includes(purpose) ||
    (purpose === "rent" && !RENT_PERIODS.includes(rentPeriod))
  ) {
    return { error: t.propertyChoices };
  }
  // Same ranges the form's NumberFields enforce while typing.
  const labels = { price: fmt(dict.fields.price, { currency: dict.currency }), area: dict.fields.area, bedrooms: dict.fields.bedrooms, bathrooms: dict.fields.bathrooms };
  const numbers = { price: 0, area: 0, bedrooms: 0, bathrooms: 0 };
  for (const key of Object.keys(numbers) as (keyof typeof numbers)[]) {
    const { min, max } = PROPERTY_LIMITS[key];
    const raw = text(fd, key);
    if (checkWholeNumber(raw, PROPERTY_LIMITS[key])) {
      return { error: fmt(t.numberRange, { field: labels[key], min: groupDigits(String(min)), max: groupDigits(String(max)) }) };
    }
    numbers[key] = Number(raw);
  }
  // Floor is optional (villas usually have none): empty is stored as null, 0 is the ground floor.
  const floor = text(fd, "floor");
  if (checkWholeNumber(floor, PROPERTY_LIMITS.floor, false)) {
    const { min, max } = PROPERTY_LIMITS.floor;
    return { error: fmt(t.numberRange, { field: dict.fields.floor, min: String(min), max: String(max) }) };
  }
  if (!validPhone(sellerPhone) && !(company && !sellerPhone)) return { error: t.badPhone };
  if (sellerWhatsapp && !validPhone(sellerWhatsapp)) {
    return { error: t.badWhatsapp };
  }

  return {
    data: {
      title,
      listingType,
      featured: admin && fd.get("featured") === "on",
      purpose,
      rentPeriod: purpose === "rent" ? rentPeriod : null,
      type,
      location,
      compound: text(fd, "compound", 80),
      ...numbers,
      floor: floor ? Number(floor) : null,
      description: text(fd, "description", TEXT_LIMITS.description),
      features: fd.getAll("features").map(String).filter((f) => (FEATURES as readonly string[]).includes(f)),
      seller: {
        type: sellerType,
        name: sellerName || (company ? COMPANY_DEFAULT_NAME : ""),
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
  // A Primary submission may carry a brochure and a payment plan, already uploaded to Blob by the
  // browser (docs/primary-documents.md). Resale submissions never keep any.
  const documents = parsed.data.listingType === "primary" ? readDocuments(fd) : [];
  if (!documents || (await Promise.all(documents.map(verifyDocument))).includes(false)) {
    return { ok: false, message: t.documentFailed };
  }

  try {
    await store.createProperty({ ...parsed.data, photos: await uploadPhotos(photos), documents });
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
  if (email && !validEmail(email)) return { ok: false, message: t.badEmail };

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
  // Slow down password guessing: a few attempts per IP, then wait for the window to pass.
  const key = `login:${clientIp(await headers())}`;
  const hit = limiter.hit(key, LIMITS.login);
  if (!hit.ok) return { ok: false, message: fmt(t.tooManyAttempts, { minutes: Math.ceil(hit.resetMs / 60_000) }) };
  if (!checkPassword(String(fd.get("password") ?? ""))) return { ok: false, message: t.wrongPassword };
  limiter.reset(key);
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
  updateTag(CACHE_TAGS.properties);
  revalidatePath("/", "layout");
}

export async function requestChanges(id: string, fd: FormData) {
  await requireAdmin();
  await store.setPropertyStatus(id, "needs_changes", text(fd, "adminNotes", 2000));
  updateTag(CACHE_TAGS.properties);
  revalidatePath("/", "layout");
}

export async function updateProperty(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = await parseProperty(fd, true);
  if ("error" in parsed) return { ok: false, message: parsed.error };
  await store.updateProperty(id, { ...parsed.data, adminNotes: text(fd, "adminNotes", 2000) });
  updateTag(CACHE_TAGS.properties);
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
  updateTag(CACHE_TAGS.properties);
  revalidatePath("/", "layout");
  redirect(`/admin/properties/${id}`);
}

// ---- Admin: rental booking calendar ----

export type BookedDaysResult = { ok: true; days: string[] } | { ok: false; message: string };

/**
 * Marks the days from `from` to `to` booked (or available again) on a rental's calendar
 * (docs/rental-calendar.md). Days before today and past the booking horizon are ignored. Returns the
 * rental's booked days after the change, so the calendar shows exactly what was saved.
 */
export async function setBookedDays(id: string, from: string, to: string, booked: boolean): Promise<BookedDaysResult> {
  await requireAdmin();
  const t = (await getDict()).msg;
  if (!isDay(from) || !isDay(to) || typeof booked !== "boolean") return { ok: false, message: t.calendarFailed };
  const property = await store.getProperty(id);
  if (!property || property.purpose !== "rent") return { ok: false, message: t.calendarFailed };
  const days = applyRange(property.bookedDates, from, to, booked, cairoToday());
  try {
    await store.setBookedDates(id, days);
  } catch (err) {
    console.error("Booking calendar update failed", err);
    return { ok: false, message: t.calendarFailed };
  }
  updateTag(CACHE_TAGS.properties);
  revalidatePath("/", "layout");
  return { ok: true, days };
}

// ---- Admin: locations ----

/** Reads the location form. `cover` is undefined when no new photo was picked. */
function parseLocationForm(fd: FormData) {
  const cover = String(fd.get("cover") ?? "");
  return {
    nameEn: text(fd, "nameEn", MAX_LOCATION_NAME),
    nameAr: text(fd, "nameAr", MAX_LOCATION_NAME),
    cover: cover || undefined,
    removeCover: fd.get("removeCover") === "on",
  };
}

const badCover = (cover?: string) => Boolean(cover && (!cover.startsWith("data:image/jpeg;base64,") || cover.length > MAX_PHOTO_CHARS));

async function locationError(input: { nameEn: string; nameAr: string; cover?: string }, exceptId?: string) {
  const t = (await getDict()).msg;
  const error = validateLocation(input, await store.getLocations(), exceptId);
  if (error === "missing") return t.locationMissing;
  if (error === "duplicate") return t.locationDuplicate;
  if (badCover(input.cover)) return t.photoFailed;
  return null;
}

export async function createLocation(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const t = (await getDict()).msg;
  const input = parseLocationForm(fd);
  const error = await locationError(input);
  if (error) return { ok: false, message: error };
  try {
    const id = uniqueSlug(slugify(input.nameEn), (await store.getLocations()).map((l) => l.id));
    const cover = input.cover ? (await uploadPhotos([input.cover], "locations"))[0] : null;
    await store.createLocation({ id, nameEn: input.nameEn, nameAr: input.nameAr, cover });
  } catch (err) {
    console.error("Location creation failed", err);
    return { ok: false, message: t.locationSaveFailed };
  }
  updateTag(CACHE_TAGS.locations);
  revalidatePath("/", "layout");
  return { ok: true, message: t.locationAdded };
}

export async function updateLocation(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const t = (await getDict()).msg;
  const input = parseLocationForm(fd);
  if (!(await store.getLocations()).some((l) => l.id === id)) return { ok: false, message: t.locationSaveFailed };
  const error = await locationError(input, id);
  if (error) return { ok: false, message: error };
  try {
    const cover = input.cover ? (await uploadPhotos([input.cover], "locations"))[0] : input.removeCover ? null : undefined;
    await store.updateLocation(id, { nameEn: input.nameEn, nameAr: input.nameAr, cover });
  } catch (err) {
    console.error("Location update failed", err);
    return { ok: false, message: t.locationSaveFailed };
  }
  updateTag(CACHE_TAGS.locations);
  revalidatePath("/", "layout");
  return { ok: true, message: t.saved };
}

/** Hide (archived = true) or restore a location. Its properties are untouched. */
export async function setLocationArchived(id: string, archived: boolean) {
  await requireAdmin();
  await store.setLocationArchived(id, archived);
  updateTag(CACHE_TAGS.locations);
  revalidatePath("/", "layout");
}

// ---- Language ----

export async function setLocale(fd: FormData) {
  const locale = fd.get("locale");
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
