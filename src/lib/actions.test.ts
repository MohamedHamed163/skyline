import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeLocation, makeProperty } from "@/test/fixtures";
import en from "./i18n/en";

// Server actions with the database, auth, uploads and Next.js runtime mocked out.

const store = vi.hoisted(() => ({
  getLocations: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
  setLocationArchived: vi.fn(),
  createProperty: vi.fn(),
  updateProperty: vi.fn(),
  getProperty: vi.fn(),
  setBookedDates: vi.fn(),
}));
const auth = vi.hoisted(() => ({ isAdmin: vi.fn() }));
const photos = vi.hoisted(() => ({ uploadPhotos: vi.fn() }));
const documents = vi.hoisted(() => ({ verifyDocument: vi.fn() }));
const nav = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

vi.mock("./store", () => store);
vi.mock("./auth", () => ({ ...auth, checkPassword: vi.fn(), startSession: vi.fn(), endSession: vi.fn() }));
vi.mock("./photos", () => photos);
vi.mock("./documents", () => documents);
vi.mock("./i18n", async () => ({ ...(await import("./i18n/shared")), getDict: async () => en, isLocale: () => true, LOCALE_COOKIE: "lang" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => nav);

const { createLocation, setBookedDays, setLocationArchived, submitProperty, updateLocation, updateProperty } = await import("./actions");

const form = (fields: Record<string, string | string[]>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const x of [v].flat()) fd.append(k, x);
  return fd;
};

const JPEG = "data:image/jpeg;base64,AAAA";

beforeEach(() => {
  vi.clearAllMocks();
  auth.isAdmin.mockResolvedValue(true);
  store.getLocations.mockResolvedValue([makeLocation(), makeLocation({ id: "giza", nameEn: "Giza", nameAr: "الجيزة", archived: true })]);
  photos.uploadPhotos.mockResolvedValue(["https://blob.example/locations/photo.jpg"]);
  documents.verifyDocument.mockResolvedValue(true);
});

describe("createLocation", () => {
  it("creates a location with a slug id", async () => {
    const result = await createLocation(null, form({ nameEn: "El Shorouk", nameAr: "الشروق" }));
    expect(result).toEqual({ ok: true, message: en.msg.locationAdded });
    expect(store.createLocation).toHaveBeenCalledWith({ id: "el-shorouk", nameEn: "El Shorouk", nameAr: "الشروق", cover: null });
    expect(photos.uploadPhotos).not.toHaveBeenCalled();
  });

  it("uploads a cover photo to the locations folder", async () => {
    await createLocation(null, form({ nameEn: "El Shorouk", nameAr: "الشروق", cover: JPEG }));
    expect(photos.uploadPhotos).toHaveBeenCalledWith([JPEG], "locations");
    expect(store.createLocation).toHaveBeenCalledWith(expect.objectContaining({ cover: "https://blob.example/locations/photo.jpg" }));
  });

  it("picks a free id when the slug is taken by a differently named location", async () => {
    store.getLocations.mockResolvedValue([makeLocation({ id: "el-shorouk", nameEn: "Shorouk (old)", nameAr: "قديم" })]);
    await createLocation(null, form({ nameEn: "El Shorouk", nameAr: "الشروق" }));
    expect(store.createLocation).toHaveBeenCalledWith(expect.objectContaining({ id: "el-shorouk-2" }));
  });

  it("rejects missing names", async () => {
    expect(await createLocation(null, form({ nameEn: "El Shorouk" }))).toEqual({ ok: false, message: en.msg.locationMissing });
    expect(store.createLocation).not.toHaveBeenCalled();
  });

  it("rejects duplicates, including hidden locations", async () => {
    expect(await createLocation(null, form({ nameEn: "giza", nameAr: "جيزة" }))).toEqual({ ok: false, message: en.msg.locationDuplicate });
  });

  it("rejects a cover that isn't a downscaled JPEG", async () => {
    const result = await createLocation(null, form({ nameEn: "El Shorouk", nameAr: "الشروق", cover: "data:image/png;base64,AAAA" }));
    expect(result).toEqual({ ok: false, message: en.msg.photoFailed });
  });

  it("reports storage failures", async () => {
    store.createLocation.mockRejectedValueOnce(new Error("db down"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    expect(await createLocation(null, form({ nameEn: "El Shorouk", nameAr: "الشروق" }))).toEqual({ ok: false, message: en.msg.locationSaveFailed });
  });

  it("requires an admin", async () => {
    auth.isAdmin.mockResolvedValue(false);
    await expect(createLocation(null, form({ nameEn: "El Shorouk", nameAr: "الشروق" }))).rejects.toThrow("REDIRECT /admin/login");
    expect(store.createLocation).not.toHaveBeenCalled();
  });
});

describe("updateLocation", () => {
  it("renames without touching the id or cover", async () => {
    const result = await updateLocation("new-cairo", null, form({ nameEn: "New Cairo City", nameAr: "القاهرة الجديدة" }));
    expect(result).toEqual({ ok: true, message: en.msg.saved });
    expect(store.updateLocation).toHaveBeenCalledWith("new-cairo", { nameEn: "New Cairo City", nameAr: "القاهرة الجديدة", cover: undefined });
  });

  it("replaces the cover when a new photo is sent", async () => {
    await updateLocation("new-cairo", null, form({ nameEn: "New Cairo", nameAr: "القاهرة الجديدة", cover: JPEG }));
    expect(store.updateLocation).toHaveBeenCalledWith("new-cairo", expect.objectContaining({ cover: "https://blob.example/locations/photo.jpg" }));
  });

  it("clears the cover when asked", async () => {
    await updateLocation("new-cairo", null, form({ nameEn: "New Cairo", nameAr: "القاهرة الجديدة", removeCover: "on" }));
    expect(store.updateLocation).toHaveBeenCalledWith("new-cairo", expect.objectContaining({ cover: null }));
  });

  it("rejects a name used by another location", async () => {
    expect(await updateLocation("new-cairo", null, form({ nameEn: "Giza", nameAr: "أخرى" }))).toEqual({ ok: false, message: en.msg.locationDuplicate });
  });

  it("rejects unknown ids", async () => {
    expect(await updateLocation("atlantis", null, form({ nameEn: "Atlantis", nameAr: "أتلانتس" }))).toEqual({ ok: false, message: en.msg.locationSaveFailed });
    expect(store.updateLocation).not.toHaveBeenCalled();
  });
});

describe("setLocationArchived", () => {
  it("hides and restores", async () => {
    await setLocationArchived("giza", true);
    await setLocationArchived("giza", false);
    expect(store.setLocationArchived.mock.calls).toEqual([["giza", true], ["giza", false]]);
  });

  it("requires an admin", async () => {
    auth.isAdmin.mockResolvedValue(false);
    await expect(setLocationArchived("giza", true)).rejects.toThrow("REDIRECT /admin/login");
    expect(store.setLocationArchived).not.toHaveBeenCalled();
  });
});

describe("submitProperty location rules", () => {
  const property = (location: string) =>
    form({
      title: "Nice flat",
      listingType: "resale",
      type: "apartment",
      location,
      price: "1000000",
      area: "100",
      bedrooms: "2",
      bathrooms: "1",
      sellerType: "owner",
      sellerName: "Owner",
      sellerPhone: "+20 100 000 0000",
      photos: JPEG,
    });

  beforeEach(() => photos.uploadPhotos.mockResolvedValue(["https://blob.example/properties/photo.jpg"]));

  it("accepts an active location", async () => {
    expect((await submitProperty(null, property("new-cairo")))?.ok).toBe(true);
    expect(store.createProperty).toHaveBeenCalledWith(expect.objectContaining({ location: "new-cairo" }));
  });

  it("rejects a hidden location on public submissions", async () => {
    expect(await submitProperty(null, property("giza"))).toEqual({ ok: false, message: en.msg.propertyChoices });
  });

  it("rejects an unknown location", async () => {
    expect(await submitProperty(null, property("atlantis"))).toEqual({ ok: false, message: en.msg.propertyChoices });
    expect(store.createProperty).not.toHaveBeenCalled();
  });
});

describe("numeric property limits", () => {
  const property = (numbers: Record<string, string>) =>
    form({
      title: "Nice flat",
      type: "apartment",
      location: "new-cairo",
      price: "1000000",
      area: "100",
      bedrooms: "2",
      bathrooms: "1",
      sellerType: "owner",
      sellerName: "Owner",
      sellerPhone: "+20 100 000 0000",
      photos: JPEG,
      ...numbers,
    });

  beforeEach(() => photos.uploadPhotos.mockResolvedValue(["https://blob.example/properties/photo.jpg"]));

  it("accepts the largest allowed price and area", async () => {
    expect((await submitProperty(null, property({ price: "1000000000", area: "5000" })))?.ok).toBe(true);
    expect(store.createProperty).toHaveBeenCalledWith(expect.objectContaining({ price: 1_000_000_000, area: 5000, bedrooms: 2, bathrooms: 1 }));
  });

  it("rejects a price over one billion", async () => {
    expect(await submitProperty(null, property({ price: "1000000001" }))).toEqual({
      ok: false,
      message: "Price (EGP) must be a whole number from 1 to 1,000,000,000.",
    });
    expect(store.createProperty).not.toHaveBeenCalled();
  });

  it("rejects an area over 5,000 m²", async () => {
    expect(await submitProperty(null, property({ area: "5001" }))).toEqual({ ok: false, message: "Area (m²) must be a whole number from 1 to 5,000." });
  });

  it("rejects decimals, exponents, zero prices and missing rooms", async () => {
    const cases: Record<string, string>[] = [{ price: "1e9" }, { area: "99.5" }, { price: "0" }, { bedrooms: "" }, { bathrooms: "51" }];
    for (const bad of cases) {
      expect((await submitProperty(null, property(bad)))?.ok).toBe(false);
    }
    expect(store.createProperty).not.toHaveBeenCalled();
  });
});

describe("floor number", () => {
  const property = (floor?: string) =>
    form({ title: "Nice flat", type: "apartment", location: "new-cairo", price: "1000000", area: "100", bedrooms: "2", bathrooms: "1", sellerType: "owner", sellerName: "Owner", sellerPhone: "+20 100 000 0000", photos: JPEG, ...(floor === undefined ? {} : { floor }) });

  beforeEach(() => photos.uploadPhotos.mockResolvedValue(["https://blob.example/properties/photo.jpg"]));

  it("is optional: an empty or missing floor is saved as null", async () => {
    expect((await submitProperty(null, property("")))?.ok).toBe(true);
    expect((await submitProperty(null, property()))?.ok).toBe(true);
    expect(store.createProperty).toHaveBeenNthCalledWith(1, expect.objectContaining({ floor: null }));
    expect(store.createProperty).toHaveBeenNthCalledWith(2, expect.objectContaining({ floor: null }));
  });

  it("saves the ground floor as 0 and accepts the top floor, 45", async () => {
    expect((await submitProperty(null, property("0")))?.ok).toBe(true);
    expect((await submitProperty(null, property("45")))?.ok).toBe(true);
    expect(store.createProperty).toHaveBeenNthCalledWith(1, expect.objectContaining({ floor: 0 }));
    expect(store.createProperty).toHaveBeenNthCalledWith(2, expect.objectContaining({ floor: 45 }));
  });

  it("rejects floors above 45 and anything that isn't a whole number", async () => {
    expect(await submitProperty(null, property("46"))).toEqual({ ok: false, message: "Floor must be a whole number from 0 to 45." });
    for (const bad of ["-1", "2.5", "G"]) {
      expect((await submitProperty(null, property(bad)))?.ok).toBe(false);
    }
    expect(store.createProperty).not.toHaveBeenCalled();
  });

  it("lets the admin change the floor when editing", async () => {
    const fd = property("12");
    fd.set("purpose", "sale");
    fd.set("listingType", "resale");
    expect(await updateProperty("p1", null, fd)).toEqual({ ok: true, message: en.msg.saved });
    expect(store.updateProperty).toHaveBeenCalledWith("p1", expect.objectContaining({ floor: 12 }));
  });
});

describe("text length limits", () => {
  const property = (text: Record<string, string>) =>
    form({ title: "Nice flat", type: "apartment", location: "new-cairo", price: "1000000", area: "100", bedrooms: "2", bathrooms: "1", sellerType: "owner", sellerName: "Owner", sellerPhone: "+20 100 000 0000", photos: JPEG, ...text });

  beforeEach(() => photos.uploadPhotos.mockResolvedValue(["https://blob.example/properties/photo.jpg"]));

  it("accepts a title and description exactly at the limit", async () => {
    expect((await submitProperty(null, property({ title: "t".repeat(120), description: "d".repeat(2000) })))?.ok).toBe(true);
  });

  it("rejects an over-long title instead of cutting it off", async () => {
    expect(await submitProperty(null, property({ title: "t".repeat(121) }))).toEqual({ ok: false, message: "Property title can be at most 120 characters." });
    expect(store.createProperty).not.toHaveBeenCalled();
  });

  it("rejects an over-long description", async () => {
    expect(await submitProperty(null, property({ description: "d".repeat(2001) }))).toEqual({ ok: false, message: "Description can be at most 2,000 characters." });
  });
});

describe("developer description (Primary only)", () => {
  const fields = {
    title: "New villa",
    type: "villa",
    location: "new-cairo",
    price: "9000000",
    area: "300",
    bedrooms: "4",
    bathrooms: "3",
    sellerType: "broker",
    sellerName: "Broker",
    sellerPhone: "+20 100 000 0000",
    photos: JPEG,
    description: "Gated compound with a clubhouse, delivery 2028.",
  };
  const developerDescription = "  Sample Developments has delivered six compounds.  ";

  beforeEach(() => photos.uploadPhotos.mockResolvedValue(["https://blob.example/properties/photo.jpg"]));

  it("saves the project and developer descriptions with a Primary submission", async () => {
    expect((await submitProperty(null, form({ ...fields, listingType: "primary", developerDescription })))?.ok).toBe(true);
    expect(store.createProperty).toHaveBeenCalledWith(
      expect.objectContaining({ description: fields.description, developerDescription: "Sample Developments has delivered six compounds." }),
    );
  });

  it("never keeps a developer description on a Resale submission", async () => {
    expect((await submitProperty(null, form({ ...fields, listingType: "resale", developerDescription })))?.ok).toBe(true);
    expect(store.createProperty).toHaveBeenCalledWith(expect.objectContaining({ description: fields.description, developerDescription: "" }));
  });

  it("is optional: a Primary submission without it is saved with an empty one", async () => {
    expect((await submitProperty(null, form({ ...fields, listingType: "primary" })))?.ok).toBe(true);
    expect(store.createProperty).toHaveBeenCalledWith(expect.objectContaining({ developerDescription: "" }));
  });

  it("accepts 2,000 characters and rejects more, naming the field", async () => {
    expect((await submitProperty(null, form({ ...fields, listingType: "primary", developerDescription: "d".repeat(2000) })))?.ok).toBe(true);
    expect(await submitProperty(null, form({ ...fields, listingType: "primary", developerDescription: "d".repeat(2001) }))).toEqual({
      ok: false,
      message: "About the developer can be at most 2,000 characters.",
    });
    expect(store.createProperty).toHaveBeenCalledTimes(1);
  });

  it("calls the description \"About the project\" in errors on Primary listings only", async () => {
    const long = "d".repeat(2001);
    expect((await submitProperty(null, form({ ...fields, listingType: "primary", description: long })))?.message).toBe("About the project can be at most 2,000 characters.");
    expect((await submitProperty(null, form({ ...fields, listingType: "resale", description: long })))?.message).toBe("Description can be at most 2,000 characters.");
  });

  it("ignores an over-long developer description on a Resale submission, since it isn't kept", async () => {
    expect((await submitProperty(null, form({ ...fields, listingType: "resale", developerDescription: "d".repeat(2001) })))?.ok).toBe(true);
  });

  it("lets the admin edit it on a Primary sale listing", async () => {
    expect((await updateProperty("p1", null, form({ ...fields, purpose: "sale", listingType: "primary", developerDescription: "Updated." })))?.ok).toBe(true);
    expect(store.updateProperty).toHaveBeenCalledWith("p1", expect.objectContaining({ developerDescription: "Updated." }));
  });

  it("clears it when the admin switches the listing to Resale or Rent", async () => {
    await updateProperty("p1", null, form({ ...fields, purpose: "sale", listingType: "resale", developerDescription }));
    await updateProperty("p1", null, form({ ...fields, purpose: "rent", rentPeriod: "month", listingType: "primary", developerDescription }));
    expect(store.updateProperty).toHaveBeenNthCalledWith(1, "p1", expect.objectContaining({ developerDescription: "" }));
    expect(store.updateProperty).toHaveBeenNthCalledWith(2, "p1", expect.objectContaining({ developerDescription: "" }));
  });
});

describe("listing type and home page (admin-only)", () => {
  const fields = {
    title: "Nice flat",
    type: "apartment",
    location: "new-cairo",
    price: "1000000",
    area: "100",
    bedrooms: "2",
    bathrooms: "1",
    sellerType: "owner",
    sellerName: "Owner",
    sellerPhone: "+20 100 000 0000",
  };

  beforeEach(() => photos.uploadPhotos.mockResolvedValue(["https://blob.example/properties/photo.jpg"]));

  it("ignores featured on public submissions", async () => {
    expect((await submitProperty(null, form({ ...fields, listingType: "resale", featured: "on", photos: JPEG })))?.ok).toBe(true);
    expect(store.createProperty).toHaveBeenCalledWith(expect.objectContaining({ featured: false }));
  });

  it("lets the admin set primary and show on the home page", async () => {
    const result = await updateProperty("p1", null, form({ ...fields, purpose: "sale", listingType: "primary", featured: "on" }));
    expect(result).toEqual({ ok: true, message: en.msg.saved });
    expect(store.updateProperty).toHaveBeenCalledWith("p1", expect.objectContaining({ listingType: "primary", featured: true }));
  });

  it("saves an edit form opened before the rename (premium) as primary", async () => {
    expect((await updateProperty("p1", null, form({ ...fields, purpose: "sale", listingType: "premium" })))?.ok).toBe(true);
    expect(store.updateProperty).toHaveBeenCalledWith("p1", expect.objectContaining({ listingType: "primary" }));
  });

  it("removes a property from the home page when the box is unticked", async () => {
    await updateProperty("p1", null, form({ ...fields, purpose: "sale", listingType: "resale" }));
    expect(store.updateProperty).toHaveBeenCalledWith("p1", expect.objectContaining({ featured: false }));
  });

  it("rejects an unknown listing type from the admin", async () => {
    expect(await updateProperty("p1", null, form({ ...fields, purpose: "sale", listingType: "gold" }))).toEqual({ ok: false, message: en.msg.propertyChoices });
    expect(store.updateProperty).not.toHaveBeenCalled();
  });
});

describe("seller's primary/resale choice and primary documents", () => {
  const BLOB = "https://abc123.public.blob.vercel-storage.com/documents";
  const fields = {
    title: "New villa",
    type: "villa",
    location: "new-cairo",
    price: "9000000",
    area: "300",
    bedrooms: "4",
    bathrooms: "3",
    sellerType: "broker",
    sellerName: "Broker",
    sellerPhone: "+20 100 000 0000",
    photos: JPEG,
  };
  const docs = {
    brochureUrl: `${BLOB}/brochure-a1.pdf`,
    brochureName: "Brochure.pdf",
    paymentPlanUrl: `${BLOB}/paymentPlan-b2.xlsx`,
    paymentPlanName: "Payment plan.xlsx",
  };

  beforeEach(() => photos.uploadPhotos.mockResolvedValue(["https://blob.example/properties/photo.jpg"]));

  it("saves the seller's choice of primary or resale", async () => {
    expect((await submitProperty(null, form({ ...fields, listingType: "primary" })))?.ok).toBe(true);
    expect((await submitProperty(null, form({ ...fields, listingType: "resale" })))?.ok).toBe(true);
    expect(store.createProperty).toHaveBeenNthCalledWith(1, expect.objectContaining({ listingType: "primary", documents: [] }));
    expect(store.createProperty).toHaveBeenNthCalledWith(2, expect.objectContaining({ listingType: "resale", documents: [] }));
  });

  it("treats a form opened before the choice existed (no listing type) as resale", async () => {
    expect((await submitProperty(null, form(fields)))?.ok).toBe(true);
    expect(store.createProperty).toHaveBeenCalledWith(expect.objectContaining({ listingType: "resale" }));
  });

  it("rejects an unknown listing type", async () => {
    expect(await submitProperty(null, form({ ...fields, listingType: "gold" }))).toEqual({ ok: false, message: en.msg.propertyChoices });
    expect(store.createProperty).not.toHaveBeenCalled();
  });

  it("saves the brochure and payment plan with a primary submission", async () => {
    expect(await submitProperty(null, form({ ...fields, listingType: "primary", ...docs }))).toEqual({ ok: true, message: en.msg.submitted });
    const saved = [
      { kind: "brochure", url: docs.brochureUrl, name: "Brochure.pdf" },
      { kind: "paymentPlan", url: docs.paymentPlanUrl, name: "Payment plan.xlsx" },
    ];
    expect(store.createProperty).toHaveBeenCalledWith(expect.objectContaining({ listingType: "primary", documents: saved }));
    expect(documents.verifyDocument.mock.calls.map(([d]) => d)).toEqual(saved);
  });

  it("accepts a primary submission with just one of the documents", async () => {
    const { brochureUrl, brochureName } = docs;
    expect((await submitProperty(null, form({ ...fields, listingType: "primary", brochureUrl, brochureName })))?.ok).toBe(true);
    expect(store.createProperty).toHaveBeenCalledWith(expect.objectContaining({ documents: [{ kind: "brochure", url: brochureUrl, name: "Brochure.pdf" }] }));
  });

  it("never keeps documents on a resale submission", async () => {
    expect((await submitProperty(null, form({ ...fields, listingType: "resale", ...docs })))?.ok).toBe(true);
    expect(store.createProperty).toHaveBeenCalledWith(expect.objectContaining({ documents: [] }));
    expect(documents.verifyDocument).not.toHaveBeenCalled();
  });

  it("rejects a document URL that isn't one of our uploads, without saving", async () => {
    const result = await submitProperty(null, form({ ...fields, listingType: "primary", ...docs, paymentPlanUrl: "https://evil.example/plan.xlsx" }));
    expect(result).toEqual({ ok: false, message: en.msg.documentFailed });
    expect(store.createProperty).not.toHaveBeenCalled();
    expect(photos.uploadPhotos).not.toHaveBeenCalled();
  });

  it("rejects a document the Blob store doesn't confirm", async () => {
    documents.verifyDocument.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect(await submitProperty(null, form({ ...fields, listingType: "primary", ...docs }))).toEqual({ ok: false, message: en.msg.documentFailed });
    expect(store.createProperty).not.toHaveBeenCalled();
  });

  it("leaves documents alone when the admin edits the property", async () => {
    await updateProperty("p1", null, form({ ...fields, purpose: "sale", listingType: "resale", ...docs }));
    expect(store.updateProperty).toHaveBeenCalledWith("p1", expect.not.objectContaining({ documents: expect.anything() }));
  });
});

describe("setBookedDays (rental booking calendar)", () => {
  const rental = (bookedDates: string[] = []) => makeProperty({ purpose: "rent", rentPeriod: "night", code: "SKY-RNT-0001", bookedDates });

  beforeEach(() => {
    // 13 October 2026, midday in Cairo.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T09:00:00Z"));
    store.getProperty.mockResolvedValue(rental(["2026-10-01", "2026-10-20"]));
  });
  afterEach(() => vi.useRealTimers());

  it("books a range, keeps the other booked days and drops past ones", async () => {
    const result = await setBookedDays("p1", "2026-10-15", "2026-10-17", true);
    const days = ["2026-10-15", "2026-10-16", "2026-10-17", "2026-10-20"];
    expect(result).toEqual({ ok: true, days });
    expect(store.getProperty).toHaveBeenCalledWith("p1");
    expect(store.setBookedDates).toHaveBeenCalledWith("p1", days);
  });

  it("frees days again", async () => {
    expect(await setBookedDays("p1", "2026-10-20", "2026-10-20", false)).toEqual({ ok: true, days: [] });
    expect(store.setBookedDates).toHaveBeenCalledWith("p1", []);
  });

  it("never books days before today in Cairo", async () => {
    expect(await setBookedDays("p1", "2026-10-10", "2026-10-13", true)).toEqual({ ok: true, days: ["2026-10-13", "2026-10-20"] });
  });

  it("rejects malformed days without reading or saving", async () => {
    for (const [from, to] of [["2026-02-30", "2026-03-01"], ["13/10/2026", "2026-10-14"], ["2026-10-14", "tomorrow"]]) {
      expect(await setBookedDays("p1", from, to, true)).toEqual({ ok: false, message: en.msg.calendarFailed });
    }
    expect(store.getProperty).not.toHaveBeenCalled();
    expect(store.setBookedDates).not.toHaveBeenCalled();
  });

  it("only works on rentals", async () => {
    store.getProperty.mockResolvedValueOnce(makeProperty({ purpose: "sale" })).mockResolvedValueOnce(undefined);
    expect(await setBookedDays("p1", "2026-10-15", "2026-10-16", true)).toEqual({ ok: false, message: en.msg.calendarFailed });
    expect(await setBookedDays("nope", "2026-10-15", "2026-10-16", true)).toEqual({ ok: false, message: en.msg.calendarFailed });
    expect(store.setBookedDates).not.toHaveBeenCalled();
  });

  it("reports storage failures", async () => {
    store.setBookedDates.mockRejectedValueOnce(new Error("db down"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    expect(await setBookedDays("p1", "2026-10-15", "2026-10-16", true)).toEqual({ ok: false, message: en.msg.calendarFailed });
  });

  it("requires an admin", async () => {
    auth.isAdmin.mockResolvedValue(false);
    await expect(setBookedDays("p1", "2026-10-15", "2026-10-16", true)).rejects.toThrow("REDIRECT /admin/login");
    expect(store.setBookedDates).not.toHaveBeenCalled();
  });
});
