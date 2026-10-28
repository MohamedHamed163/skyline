import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeHost, makeLocation, makeProperty, makeSubLocation } from "@/test/fixtures";
import en from "./i18n/en";

// Server actions with the database, auth, uploads and Next.js runtime mocked out.

const store = vi.hoisted(() => ({
  getLocations: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
  setLocationArchived: vi.fn(),
  createSubLocation: vi.fn(),
  updateSubLocation: vi.fn(),
  setSubLocationArchived: vi.fn(),
  linkTypedSubLocation: vi.fn(),
  createProperty: vi.fn(),
  codeTaken: vi.fn(),
  updateProperty: vi.fn(),
  getProperty: vi.fn(),
  setBookedDates: vi.fn(),
  setPropertyStatus: vi.fn(),
  getHost: vi.fn(),
  getHostLogin: vi.fn(),
  createHost: vi.fn(),
  setHostPassword: vi.fn(),
  logImpersonation: vi.fn(),
  createPasswordRequest: vi.fn(),
  resolvePasswordRequest: vi.fn(),
  resolveHostPasswordRequests: vi.fn(),
  updateHostProperty: vi.fn(),
  saveHostEdit: vi.fn(),
  approveHostEdit: vi.fn(),
  rejectHostEdit: vi.fn(),
}));
const auth = vi.hoisted(() => ({ isAdmin: vi.fn() }));
const hostAuth = vi.hoisted(() => ({ currentHost: vi.fn(), hostSessionsEnabled: vi.fn(), startHostSession: vi.fn(), endHostSession: vi.fn() }));
// Each test calls from its own IP, so the sign-in and sign-up rate limits don't carry over.
const client = vi.hoisted(() => ({ ip: "" }));
const photos = vi.hoisted(() => ({ uploadPhotos: vi.fn() }));
const documents = vi.hoisted(() => ({ verifyDocument: vi.fn() }));
const nav = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

vi.mock("./store", () => store);
vi.mock("./auth", () => ({ ...auth, checkPassword: vi.fn(), startSession: vi.fn(), endSession: vi.fn() }));
vi.mock("./host-auth", () => hostAuth);
vi.mock("./photos", () => photos);
vi.mock("./documents", () => documents);
vi.mock("./i18n", async () => ({ ...(await import("./i18n/shared")), getDict: async () => en, isLocale: () => true, LOCALE_COOKIE: "lang" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: async () => new Headers({ "x-forwarded-for": client.ip }) }));
vi.mock("next/navigation", () => nav);

const {
  approveHostEdit,
  changeHostPassword,
  createLocation,
  createPropertyAdmin,
  createSubLocation,
  matchTypedSubLocation,
  setSubLocationArchived,
  updateSubLocation,
  dismissPasswordRequest,
  hostSignIn,
  hostSignOut,
  hostSignUp,
  impersonateHost,
  rejectHostEdit,
  requestPasswordReset,
  resetHostPassword,
  stopImpersonating,
  setBookedDays,
  setLocationArchived,
  submitProperty,
  updateHostProperty,
  updateLocation,
  updateProperty,
} = await import("./actions");

const form = (fields: Record<string, string | string[]>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const x of [v].flat()) fd.append(k, x);
  return fd;
};

const JPEG = "data:image/jpeg;base64,AAAA";
const fmtMinutes = (template: string, minutes: number) => template.replace("{minutes}", String(minutes));
const HOST = makeHost({ sessionVersion: 4 });
let ipCount = 0;

beforeEach(() => {
  vi.clearAllMocks();
  auth.isAdmin.mockResolvedValue(true);
  hostAuth.currentHost.mockResolvedValue(HOST);
  hostAuth.hostSessionsEnabled.mockReturnValue(true);
  client.ip = `10.0.0.${++ipCount}`;
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

describe("photo count", () => {
  const fields = {
    title: "Nice flat",
    listingType: "primary",
    purpose: "sale",
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
  const rental = { ...fields, purpose: "rent", listingType: "resale", code: "RNT-0101" };
  const withPhotos = (n: number, base: Record<string, string> = fields) => form({ ...base, photos: Array(n).fill(JPEG) });
  const tooMany = { ok: false, message: "Please add between 1 and 8 photos." };

  beforeEach(() => {
    photos.uploadPhotos.mockImplementation(async (list: string[]) => list.map((_, i) => `https://blob.example/properties/${i}.jpg`));
    store.createProperty.mockResolvedValue("new-id");
  });

  it("accepts up to 8 photos on a public submission", async () => {
    expect((await submitProperty(null, withPhotos(8)))?.ok).toBe(true);
    expect(store.createProperty.mock.calls[0][0].photos).toHaveLength(8);
  });

  it("rejects 9 photos, or none, on a public submission", async () => {
    expect(await submitProperty(null, withPhotos(9))).toEqual(tooMany);
    expect(await submitProperty(null, withPhotos(0))).toEqual(tooMany);
    expect(photos.uploadPhotos).not.toHaveBeenCalled();
    expect(store.createProperty).not.toHaveBeenCalled();
  });

  it("allows the admin 8 photos but not 9 on a sale listing", async () => {
    await expect(createPropertyAdmin(null, withPhotos(8))).rejects.toThrow("REDIRECT /admin/properties/new-id");
    expect(store.createProperty.mock.calls[0][0].photos).toHaveLength(8);
    expect(await createPropertyAdmin(null, withPhotos(9))).toEqual(tooMany);
    expect(store.createProperty).toHaveBeenCalledTimes(1);
  });

  it("allows a rental 15 photos", async () => {
    await expect(createPropertyAdmin(null, withPhotos(15, rental))).rejects.toThrow("REDIRECT /admin/properties/new-id");
    expect(store.createProperty).toHaveBeenCalledWith(expect.objectContaining({ purpose: "rent" }));
    expect(store.createProperty.mock.calls[0][0].photos).toHaveLength(15);
  });

  it("rejects 16 photos, or none, on a rental without uploading anything", async () => {
    const tooManyForRental = { ok: false, message: "Please add between 1 and 15 photos." };
    expect(await createPropertyAdmin(null, withPhotos(16, rental))).toEqual(tooManyForRental);
    expect(await createPropertyAdmin(null, withPhotos(0, rental))).toEqual(tooManyForRental);
    expect(photos.uploadPhotos).not.toHaveBeenCalled();
    expect(store.createProperty).not.toHaveBeenCalled();
  });

  it("keeps public submissions at 8 photos even if they claim to be a rental", async () => {
    expect(await submitProperty(null, withPhotos(9, rental))).toEqual(tooMany);
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
    await updateProperty("p1", null, form({ ...fields, purpose: "rent", listingType: "primary", developerDescription }));
    expect(store.updateProperty).toHaveBeenNthCalledWith(1, "p1", expect.objectContaining({ developerDescription: "" }));
    expect(store.updateProperty).toHaveBeenNthCalledWith(2, "p1", expect.objectContaining({ developerDescription: "" }));
  });
});

describe("unit ranges (Primary only)", () => {
  const fields = {
    title: "New compound",
    type: "apartment",
    location: "new-cairo",
    price: "5000000",
    area: "100",
    bedrooms: "3",
    bathrooms: "1",
    floor: "1",
    sellerType: "broker",
    sellerName: "Broker",
    sellerPhone: "+20 100 000 0000",
    photos: JPEG,
  };
  const ranges = { priceMax: "12000000", areaMax: "400", bedroomsMax: "5", bathroomsMax: "3", floorMax: "10" };
  const none = { areaMax: null, bedroomsMax: null, bathroomsMax: null, floorMax: null, priceMax: null };

  beforeEach(() => photos.uploadPhotos.mockResolvedValue(["https://blob.example/properties/photo.jpg"]));

  it("saves the from and to values with a Primary submission", async () => {
    expect((await submitProperty(null, form({ ...fields, ...ranges, listingType: "primary" })))?.ok).toBe(true);
    expect(store.createProperty).toHaveBeenCalledWith(
      expect.objectContaining({
        price: 5_000_000,
        priceMax: 12_000_000,
        area: 100,
        areaMax: 400,
        bedrooms: 3,
        bedroomsMax: 5,
        bathrooms: 1,
        bathroomsMax: 3,
        floor: 1,
        floorMax: 10,
      }),
    );
  });

  it("leaves \"to\" optional, and stores a \"to\" equal to the \"from\" as a single value", async () => {
    await submitProperty(null, form({ ...fields, listingType: "primary" }));
    await submitProperty(null, form({ ...fields, listingType: "primary", areaMax: "100", bedroomsMax: "3", priceMax: "" }));
    expect(store.createProperty).toHaveBeenNthCalledWith(1, expect.objectContaining(none));
    expect(store.createProperty).toHaveBeenNthCalledWith(2, expect.objectContaining(none));
  });

  it("never keeps ranges on a Resale submission, and ignores invalid ones there", async () => {
    expect((await submitProperty(null, form({ ...fields, ...ranges, listingType: "resale" })))?.ok).toBe(true);
    expect((await submitProperty(null, form({ ...fields, areaMax: "1", listingType: "resale" })))?.ok).toBe(true);
    expect(store.createProperty).toHaveBeenNthCalledWith(1, expect.objectContaining({ area: 100, ...none }));
  });

  it("rejects a \"to\" below the \"from\", naming the field", async () => {
    expect(await submitProperty(null, form({ ...fields, listingType: "primary", areaMax: "99" }))).toEqual({
      ok: false,
      message: "Area (m²): the “to” value must be at least the “from” value.",
    });
    expect(await submitProperty(null, form({ ...fields, listingType: "primary", priceMax: "4999999" }))).toEqual({
      ok: false,
      message: "Price (EGP): the “to” value must be at least the “from” value.",
    });
    expect(store.createProperty).not.toHaveBeenCalled();
  });

  it("rejects a \"to\" outside the field's limits", async () => {
    expect(await submitProperty(null, form({ ...fields, listingType: "primary", bedroomsMax: "51" }))).toEqual({
      ok: false,
      message: "Bedrooms “to” value must be a whole number from 0 to 50.",
    });
    expect((await submitProperty(null, form({ ...fields, listingType: "primary", floorMax: "abc" })))?.ok).toBe(false);
    expect(store.createProperty).not.toHaveBeenCalled();
  });

  it("needs a \"from\" floor when a \"to\" floor is given", async () => {
    expect(await submitProperty(null, form({ ...fields, listingType: "primary", floor: "", floorMax: "10" }))).toEqual({
      ok: false,
      message: "Floor: fill in the “from” value too, or leave “to” empty.",
    });
  });

  it("lets the admin edit ranges, and clears them when switching to Resale or Rent", async () => {
    await updateProperty("p1", null, form({ ...fields, ...ranges, purpose: "sale", listingType: "primary" }));
    await updateProperty("p1", null, form({ ...fields, ...ranges, purpose: "sale", listingType: "resale" }));
    await updateProperty("p1", null, form({ ...fields, ...ranges, purpose: "rent", listingType: "primary" }));
    expect(store.updateProperty).toHaveBeenNthCalledWith(1, "p1", expect.objectContaining({ areaMax: 400, priceMax: 12_000_000 }));
    expect(store.updateProperty).toHaveBeenNthCalledWith(2, "p1", expect.objectContaining(none));
    expect(store.updateProperty).toHaveBeenNthCalledWith(3, "p1", expect.objectContaining(none));
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

describe("rentals skip Pending Approvals (admin edit)", () => {
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
    listingType: "resale",
  };

  it("publishes a pending submission the admin switches to Rent", async () => {
    store.getProperty.mockResolvedValueOnce(makeProperty({ status: "pending", code: null }));
    expect((await updateProperty("p1", null, form({ ...fields, purpose: "rent" })))?.ok).toBe(true);
    expect(store.setPropertyStatus).toHaveBeenCalledWith("p1", "published");
  });

  it("leaves a pending sale waiting for review", async () => {
    store.getProperty.mockResolvedValueOnce(makeProperty({ status: "pending", code: null }));
    await updateProperty("p1", null, form({ ...fields, purpose: "sale" }));
    expect(store.setPropertyStatus).not.toHaveBeenCalled();
  });

  it("doesn't change the status of a rental that isn't pending", async () => {
    store.getProperty.mockResolvedValueOnce(makeProperty({ purpose: "rent", status: "archived" }));
    await updateProperty("p1", null, form({ ...fields, purpose: "rent" }));
    expect(store.setPropertyStatus).not.toHaveBeenCalled();
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
  const rental = (bookedDates: string[] = []) => makeProperty({ purpose: "rent", code: "SKY-RNT-0001", bookedDates });

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

describe("rental prices that change by date", () => {
  const rental = {
    purpose: "rent",
    listingType: "resale",
    code: "RNT-0101",
    title: "Sea-view chalet",
    type: "chalet",
    location: "new-cairo",
    price: "3000",
    area: "100",
    bedrooms: "2",
    bathrooms: "1",
    sellerType: "company",
  };
  const summer = { from: "2027-06-01", to: "2027-07-31", price: 8000, weekendPrice: 10_000 };
  const saved = () => store.updateProperty.mock.calls[0][1];

  beforeEach(() => {
    // 13 October 2026, midday in Cairo.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T09:00:00Z"));
    photos.uploadPhotos.mockResolvedValue(["https://blob.example/properties/photo.jpg"]);
    store.createProperty.mockResolvedValue("new-id");
  });
  afterEach(() => vi.useRealTimers());

  it("saves the weekend price and special prices of a nightly rental", async () => {
    const result = await updateProperty("p1", null, form({ ...rental, weekendPrice: "4500", priceRules: JSON.stringify([summer]) }));
    expect(result).toEqual({ ok: true, message: en.msg.saved });
    expect(saved()).toEqual(expect.objectContaining({ price: 3000, weekendPrice: 4500, priceRules: [summer] }));
  });

  it("publishes a new rental with its prices", async () => {
    await expect(createPropertyAdmin(null, form({ ...rental, weekendPrice: "4500", priceRules: JSON.stringify([summer]), photos: JPEG }))).rejects.toThrow(
      "REDIRECT /admin/properties/new-id",
    );
    expect(store.createProperty).toHaveBeenCalledWith(expect.objectContaining({ purpose: "rent", weekendPrice: 4500, priceRules: [summer] }));
    expect(store.setPropertyStatus).toHaveBeenCalledWith("new-id", "published");
  });

  it("treats both as optional", async () => {
    await updateProperty("p1", null, form({ ...rental, weekendPrice: "", priceRules: "" }));
    await updateProperty("p2", null, form(rental));
    for (const [, input] of store.updateProperty.mock.calls) expect(input).toEqual(expect.objectContaining({ weekendPrice: null, priceRules: [] }));
  });

  it("rejects a weekend price that isn't a whole number from 1 to 1,000,000,000", async () => {
    for (const weekendPrice of ["0", "1000000001", "4.5", "abc"]) {
      expect(await updateProperty("p1", null, form({ ...rental, weekendPrice }))).toEqual({
        ok: false,
        message: "Weekend nights (EGP) must be a whole number from 1 to 1,000,000,000.",
      });
    }
    expect(store.updateProperty).not.toHaveBeenCalled();
  });

  it("prices every rental per night, even when a form opened before the change still says monthly", async () => {
    const result = await updateProperty("p1", null, form({ ...rental, rentPeriod: "month", weekendPrice: "4500", priceRules: JSON.stringify([summer]) }));
    expect(result?.ok).toBe(true);
    expect(saved()).toEqual(expect.objectContaining({ weekendPrice: 4500, priceRules: [summer] }));
    expect(saved()).not.toHaveProperty("rentPeriod");
  });

  it("never keeps rental prices on sale listings", async () => {
    await updateProperty("p1", null, form({ ...rental, purpose: "sale", price: "2000000", weekendPrice: "4500", priceRules: "not json" }));
    expect(saved()).toEqual(expect.objectContaining({ purpose: "sale", weekendPrice: null, priceRules: [] }));
  });

  it("ignores them on public submissions, which are always sales", async () => {
    const fields = { ...rental, sellerType: "owner", sellerName: "Owner", sellerPhone: "+20 100 000 0000", photos: JPEG };
    expect((await submitProperty(null, form({ ...fields, weekendPrice: "4500", priceRules: JSON.stringify([summer]) })))?.ok).toBe(true);
    expect(store.createProperty).toHaveBeenCalledWith(expect.objectContaining({ purpose: "sale", weekendPrice: null, priceRules: [] }));
  });

  it("refuses malformed special prices without saving", async () => {
    const bad = [
      { ...rental, priceRules: "not json" },
      { ...rental, priceRules: JSON.stringify([{ ...summer, price: 0 }]) },
      // Special prices for whole months, as monthly rentals used to have.
      { ...rental, priceRules: JSON.stringify([{ from: "2027-06", to: "2027-07", price: 40_000, weekendPrice: null }]) },
    ];
    for (const fields of bad) expect(await updateProperty("p1", null, form(fields))).toEqual({ ok: false, message: en.msg.priceRulesFailed });
    expect(store.updateProperty).not.toHaveBeenCalled();
  });

  it("drops special prices that are over and starts the current one today in Cairo", async () => {
    const list = [{ from: "2026-09-01", to: "2026-09-30", price: 5000 }, { from: "2026-10-01", to: "2026-10-20", price: 6000 }];
    await updateProperty("p1", null, form({ ...rental, priceRules: JSON.stringify(list) }));
    expect(saved().priceRules).toEqual([{ from: "2026-10-13", to: "2026-10-20", price: 6000, weekendPrice: null }]);
  });
});

describe("rental codes typed by the admin", () => {
  const rental = {
    purpose: "rent",
    listingType: "resale",
    title: "Sea-view chalet",
    type: "chalet",
    location: "new-cairo",
    price: "3000",
    area: "100",
    bedrooms: "2",
    bathrooms: "1",
    sellerType: "company",
    photos: JPEG,
  };
  const sale = { ...rental, purpose: "sale", listingType: "resale", sellerType: "owner", sellerName: "Owner", sellerPhone: "+20 100 000 0000" };
  const invalid = { ok: false, message: "Enter a rental code of up to 10 letters (English or Arabic), numbers and dashes, with no spaces or symbols, e.g. A101 or شاليه-٥." };
  const conflict = Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505", constraint_name: "properties_code_key" });

  beforeEach(() => {
    photos.uploadPhotos.mockResolvedValue(["https://blob.example/properties/photo.jpg"]);
    store.createProperty.mockResolvedValue("new-id");
    store.codeTaken.mockResolvedValue(false);
  });

  it("publishes a new rental with the code the admin typed, trimmed and in capitals", async () => {
    await expect(createPropertyAdmin(null, form({ ...rental, code: "  rnt-0101 " }))).rejects.toThrow("REDIRECT /admin/properties/new-id");
    expect(store.codeTaken).toHaveBeenCalledWith("RNT-0101");
    expect(store.createProperty).toHaveBeenCalledWith(expect.objectContaining({ purpose: "rent", code: "RNT-0101" }));
    expect(store.setPropertyStatus).toHaveBeenCalledWith("new-id", "published");
  });

  it("accepts any format of English or Arabic letters, digits and dashes, up to 10 characters", async () => {
    const codes = ["VILLA12", "NC-A-3", "7", "شاليه-٥", "فيلا12", "٠١٢٣", "A".repeat(10), "ش".repeat(10)];
    for (const code of codes) {
      await expect(createPropertyAdmin(null, form({ ...rental, code }))).rejects.toThrow("REDIRECT");
    }
    expect(store.createProperty.mock.calls.map(([input]) => input.code)).toEqual(codes);
  });

  it("requires a code on a rental", async () => {
    expect(await createPropertyAdmin(null, form(rental))).toEqual(invalid);
    expect(await createPropertyAdmin(null, form({ ...rental, code: "   " }))).toEqual(invalid);
    expect(store.createProperty).not.toHaveBeenCalled();
  });

  it("rejects codes that can't go in a web address, or are too long, before uploading photos", async () => {
    for (const code of ["SKY RNT 1", "SKY/RNT/1", "-SKY", "SKY--1", "SKY-", "كود 1", "كود/1", "SKY-RNT-0101", "A".repeat(11), "ش".repeat(11)]) {
      expect(await createPropertyAdmin(null, form({ ...rental, code }))).toEqual(invalid);
    }
    expect(photos.uploadPhotos).not.toHaveBeenCalled();
    expect(store.createProperty).not.toHaveBeenCalled();
  });

  it("rejects a code another property already uses", async () => {
    store.codeTaken.mockResolvedValue(true);
    expect(await createPropertyAdmin(null, form({ ...rental, code: "rnt-0001" }))).toEqual({
      ok: false,
      message: "The code RNT-0001 is already used by another property. Please choose a different code.",
    });
    expect(photos.uploadPhotos).not.toHaveBeenCalled();
    expect(store.createProperty).not.toHaveBeenCalled();
  });

  it("reports a code taken while the rental was being saved", async () => {
    store.createProperty.mockRejectedValueOnce(conflict);
    expect(await createPropertyAdmin(null, form({ ...rental, code: "شاليه-٥" }))).toEqual({
      ok: false,
      message: "The code شاليه-٥ is already used by another property. Please choose a different code.",
    });
    expect(store.setPropertyStatus).not.toHaveBeenCalled();
  });

  it("still reports other storage failures as a failed save", async () => {
    store.createProperty.mockRejectedValueOnce(new Error("db down"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    expect(await createPropertyAdmin(null, form({ ...rental, code: "RNT-0101" }))).toEqual({ ok: false, message: en.msg.saveFailed });
  });

  it("ignores a code on a sale listing, which gets one on publishing", async () => {
    await expect(createPropertyAdmin(null, form({ ...sale, code: "MY-CODE" }))).rejects.toThrow("REDIRECT /admin/properties/new-id");
    expect(store.codeTaken).not.toHaveBeenCalled();
    expect(store.createProperty).toHaveBeenCalledWith(expect.objectContaining({ purpose: "sale", code: undefined }));
  });

  it("never lets a public submission set a code", async () => {
    expect((await submitProperty(null, form({ ...sale, code: "MY-CODE" })))?.ok).toBe(true);
    expect(store.createProperty.mock.calls[0][0]).not.toHaveProperty("code");
  });

  it("leaves the code alone when a listing is edited", async () => {
    await updateProperty("p1", null, form({ ...rental, code: "NEW-CODE" }));
    expect(store.updateProperty.mock.calls[0][1]).not.toHaveProperty("code");
  });
});

describe("host accounts: sign up", () => {
  const signUp = (o: Record<string, string> = {}) => hostSignUp(null, form({ username: "Ahmed.Broker", password: "secret-pass", confirmPassword: "secret-pass", ...o }));

  beforeEach(() => {
    store.getHostLogin.mockResolvedValue(undefined);
    store.createHost.mockResolvedValue("h9");
  });

  it("creates the account in lower case with a hashed password, signs it in and opens the form", async () => {
    await expect(signUp()).rejects.toThrow("REDIRECT /submit");
    const [{ username, passwordHash }] = store.createHost.mock.calls[0];
    expect(username).toBe("ahmed.broker");
    expect(passwordHash).not.toContain("secret-pass");
    const { verifyPassword } = await import("./passwords");
    expect(await verifyPassword("secret-pass", passwordHash)).toBe(true);
    expect(hostAuth.startHostSession).toHaveBeenCalledWith("h9", 0);
  });

  it("checks the form before touching the database", async () => {
    expect(await signUp({ username: "أحمد" })).toEqual({ ok: false, message: "Choose a username of 3–30 English letters, numbers, spaces or symbols." });
    expect(await signUp({ password: "short", confirmPassword: "short" })).toEqual({ ok: false, message: "Your password must have at least 8 characters." });
    expect(await signUp({ confirmPassword: "secret-pasS" })).toEqual({ ok: false, message: en.account.errors.passwordMismatch });
    expect(store.getHostLogin).not.toHaveBeenCalled();
    expect(store.createHost).not.toHaveBeenCalled();
  });

  it("refuses a username that is taken, in any letter case", async () => {
    store.getHostLogin.mockResolvedValue({ host: HOST, passwordHash: "x" });
    expect(await signUp({ username: "AHMED" })).toEqual({ ok: false, message: "The username ahmed is taken. Please choose another one." });
    expect(store.getHostLogin).toHaveBeenCalledWith("ahmed");
    expect(store.createHost).not.toHaveBeenCalled();
    expect(hostAuth.startHostSession).not.toHaveBeenCalled();
  });

  it("reports a username taken between the check and the insert", async () => {
    store.createHost.mockRejectedValue({ code: "23505", constraint_name: "hosts_username_key" });
    expect(await signUp()).toEqual({ ok: false, message: "The username ahmed.broker is taken. Please choose another one." });
  });

  it("reports storage failures", async () => {
    store.createHost.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    expect(await signUp()).toEqual({ ok: false, message: en.account.errors.createFailed });
  });

  it("allows 5 new accounts an hour per connection", async () => {
    for (let i = 0; i < 5; i++) await expect(signUp({ username: `host${i}` })).rejects.toThrow("REDIRECT");
    expect((await signUp({ username: "host5" }))?.message).toMatch(/^Too many new accounts from this connection/);
    expect(store.createHost).toHaveBeenCalledTimes(5);
  });

  it("is unavailable without a session secret", async () => {
    hostAuth.hostSessionsEnabled.mockReturnValue(false);
    expect(await signUp()).toEqual({ ok: false, message: en.account.errors.notConfigured });
    expect(store.createHost).not.toHaveBeenCalled();
  });
});

describe("host accounts: sign in and out", () => {
  let passwordHash = "";
  const signIn = (username: string, password: string) => hostSignIn(null, form({ username, password }));

  beforeEach(async () => {
    passwordHash ||= await (await import("./passwords")).hashPassword("secret-pass");
    store.getHostLogin.mockImplementation(async (u: string) => (u === "ahmed" ? { host: HOST, passwordHash } : undefined));
  });

  it("signs in with the right password, in any letter case, and opens the account", async () => {
    await expect(signIn(" Ahmed ", "secret-pass")).rejects.toThrow("REDIRECT /account");
    // With the account's session version, so a later password change ends this session.
    expect(hostAuth.startHostSession).toHaveBeenCalledWith("h1", HOST.sessionVersion);
  });

  it("gives the same answer for a wrong password and an unknown username", async () => {
    const wrong = { ok: false, message: en.account.errors.wrongLogin };
    expect(await signIn("ahmed", "secret-pasS")).toEqual(wrong);
    expect(await signIn("nobody", "secret-pass")).toEqual(wrong);
    expect(await signIn("ahmed", "x".repeat(129))).toEqual(wrong);
    expect(hostAuth.startHostSession).not.toHaveBeenCalled();
  });

  it("allows 5 wrong attempts per 15 minutes, and a good sign-in clears the count", async () => {
    for (let i = 0; i < 4; i++) await signIn("ahmed", "wrong");
    await expect(signIn("ahmed", "secret-pass")).rejects.toThrow("REDIRECT /account");
    for (let i = 0; i < 5; i++) expect((await signIn("ahmed", "wrong"))?.message).toBe(en.account.errors.wrongLogin);
    expect((await signIn("ahmed", "secret-pass"))?.message).toBe("Too many sign-in attempts. Try again in 15 min.");
  });

  it("is unavailable without a session secret", async () => {
    hostAuth.hostSessionsEnabled.mockReturnValue(false);
    expect(await signIn("ahmed", "secret-pass")).toEqual({ ok: false, message: en.account.errors.notConfigured });
  });

  it("signs out back to the List a property page", async () => {
    await expect(hostSignOut()).rejects.toThrow("REDIRECT /submit");
    expect(hostAuth.endHostSession).toHaveBeenCalled();
  });
});

describe("host accounts: change password", () => {
  let passwordHash = "";
  let host = makeHost();
  let accounts = 0;
  const change = (o: Record<string, string> = {}) =>
    changeHostPassword(null, form({ currentPassword: "secret-pass", password: "new-secret", confirmPassword: "new-secret", ...o }));

  beforeEach(async () => {
    passwordHash ||= await (await import("./passwords")).hashPassword("secret-pass");
    // A new account in each test: wrong passwords are counted per account.
    host = makeHost({ id: `pw${++accounts}`, sessionVersion: 4 });
    hostAuth.currentHost.mockResolvedValue(host);
    store.getHostLogin.mockImplementation(async (u: string) => (u === host.username ? { host, passwordHash } : undefined));
    store.setHostPassword.mockResolvedValue(5);
  });

  it("saves the new password hashed, signs out the other sessions and keeps this one", async () => {
    expect(await change()).toEqual({ ok: true, message: en.account.passwordChanged });
    const [id, hash, temporary] = store.setHostPassword.mock.calls[0];
    expect([id, temporary]).toEqual([host.id, false]);
    const { verifyPassword } = await import("./passwords");
    expect(await verifyPassword("new-secret", hash)).toBe(true);
    expect(hostAuth.startHostSession).toHaveBeenCalledWith(host.id, 5);
  });

  it("refuses when signed out, e.g. after a password change in another browser", async () => {
    hostAuth.currentHost.mockResolvedValue(null);
    expect(await change()).toEqual({ ok: false, message: en.account.errors.signInAgain });
    expect(store.setHostPassword).not.toHaveBeenCalled();
  });

  it("checks the new password before the current one", async () => {
    expect(await change({ password: "short", confirmPassword: "short" })).toEqual({ ok: false, message: "Your password must have at least 8 characters." });
    expect(await change({ confirmPassword: "new-secreT" })).toEqual({ ok: false, message: en.account.errors.passwordMismatch });
    expect(await change({ password: "secret-pass", confirmPassword: "secret-pass" })).toEqual({ ok: false, message: en.account.errors.passwordUnchanged });
    expect(store.getHostLogin).not.toHaveBeenCalled();
    expect(store.setHostPassword).not.toHaveBeenCalled();
  });

  it("refuses a wrong current password", async () => {
    const wrong = { ok: false, message: en.account.errors.wrongCurrentPassword };
    expect(await change({ currentPassword: "secret-pasS" })).toEqual(wrong);
    expect(await change({ currentPassword: "x".repeat(129) })).toEqual(wrong);
    expect(store.setHostPassword).not.toHaveBeenCalled();
    expect(hostAuth.startHostSession).not.toHaveBeenCalled();
  });

  it("allows 5 wrong current passwords per 15 minutes per account, and a right one clears the count", async () => {
    for (let i = 0; i < 4; i++) await change({ currentPassword: "wrong" });
    expect((await change())?.ok).toBe(true);
    for (let i = 0; i < 5; i++) expect((await change({ currentPassword: "wrong" }))?.message).toBe(en.account.errors.wrongCurrentPassword);
    expect((await change())?.message).toBe("Too many wrong passwords. Try again in 15 min.");
    // Another connection doesn't get a new allowance: it belongs to the account.
    client.ip = "10.9.9.9";
    expect((await change())?.message).toBe("Too many wrong passwords. Try again in 15 min.");
    expect(store.setHostPassword).toHaveBeenCalledTimes(1);
  });

  it("reports storage failures, and an account deleted meanwhile", async () => {
    store.setHostPassword.mockRejectedValueOnce(new Error("db down"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    expect(await change()).toEqual({ ok: false, message: en.account.errors.passwordChangeFailed });
    store.setHostPassword.mockResolvedValueOnce(undefined);
    expect(await change()).toEqual({ ok: false, message: en.account.errors.signInAgain });
    expect(hostAuth.startHostSession).not.toHaveBeenCalled();
  });
});

describe("admin: temporary host password", () => {
  beforeEach(() => {
    store.setHostPassword.mockResolvedValue(3);
  });

  it("sets a temporary password, returns it once and signs the host out everywhere", async () => {
    const result = await resetHostPassword("h1");
    if (!result.ok) throw new Error(result.message);
    expect(result.password).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
    const [id, hash, temporary] = store.setHostPassword.mock.calls[0];
    expect([id, temporary]).toEqual(["h1", true]);
    expect(hash).not.toContain(result.password);
    const { verifyPassword } = await import("./passwords");
    expect(await verifyPassword(result.password, hash)).toBe(true);
    // The admin's browser doesn't get a host session.
    expect(hostAuth.startHostSession).not.toHaveBeenCalled();
  });

  it("is admin-only", async () => {
    auth.isAdmin.mockResolvedValue(false);
    await expect(resetHostPassword("h1")).rejects.toThrow("REDIRECT /admin/login");
    expect(store.setHostPassword).not.toHaveBeenCalled();
  });

  it("reports a missing account and storage failures", async () => {
    store.setHostPassword.mockResolvedValueOnce(undefined);
    expect(await resetHostPassword("gone")).toEqual({ ok: false, message: en.admin.hostPassword.failed });
    store.setHostPassword.mockRejectedValueOnce(new Error("db down"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    expect(await resetHostPassword("h1")).toEqual({ ok: false, message: en.admin.hostPassword.failed });
  });
});

describe("admin: password typed by the admin", () => {
  beforeEach(() => {
    store.setHostPassword.mockResolvedValue(3);
    store.resolveHostPasswordRequests.mockResolvedValue(undefined);
  });

  it("sets the typed password exactly as typed, flagged temporary, and returns it once", async () => {
    expect(await resetHostPassword("h1", " New pass 1 ")).toEqual({ ok: true, password: " New pass 1 " });
    const [id, hash, temporary] = store.setHostPassword.mock.calls[0];
    expect([id, temporary]).toEqual(["h1", true]);
    expect(hash).not.toContain("New pass");
    const { verifyPassword } = await import("./passwords");
    expect(await verifyPassword(" New pass 1 ", hash)).toBe(true);
  });

  it("refuses a password that is too short or too long", async () => {
    expect(await resetHostPassword("h1", "short")).toEqual({ ok: false, message: "Your password must have at least 8 characters." });
    expect(await resetHostPassword("h1", "x".repeat(129))).toEqual({ ok: false, message: "Your password can have at most 128 characters." });
    expect(store.setHostPassword).not.toHaveBeenCalled();
  });

  it("closes the account's open forgot-password requests, generated or typed", async () => {
    await resetHostPassword("h1");
    await resetHostPassword("h1", "chosen-password");
    expect(store.resolveHostPasswordRequests).toHaveBeenCalledTimes(2);
    expect(store.resolveHostPasswordRequests).toHaveBeenCalledWith("h1");
  });

  it("still returns the new password when closing the requests fails", async () => {
    store.resolveHostPasswordRequests.mockRejectedValueOnce(new Error("db down"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    expect(await resetHostPassword("h1", "chosen-password")).toEqual({ ok: true, password: "chosen-password" });
  });

  it("doesn't close requests when the password wasn't set", async () => {
    store.setHostPassword.mockResolvedValueOnce(undefined);
    await resetHostPassword("gone", "chosen-password");
    expect(store.resolveHostPasswordRequests).not.toHaveBeenCalled();
  });

  it("is admin-only", async () => {
    auth.isAdmin.mockResolvedValue(false);
    await expect(resetHostPassword("h1", "chosen-password")).rejects.toThrow("REDIRECT /admin/login");
    expect(store.setHostPassword).not.toHaveBeenCalled();
  });
});

describe("host accounts: forgot password request", () => {
  beforeEach(() => {
    store.getHostLogin.mockResolvedValue({ host: HOST, passwordHash: "scrypt$aa$bb" });
    store.createPasswordRequest.mockResolvedValue("r1");
  });

  it("saves the request against the account, with the username normalized", async () => {
    const result = await requestPasswordReset(null, form({ username: "  Ahmed ", phone: "01012345678" }));
    expect(result).toEqual({ ok: true, message: "Request sent. Skyline will contact you on 01012345678 with a temporary password." });
    expect(store.getHostLogin).toHaveBeenCalledWith("ahmed");
    expect(store.createPasswordRequest).toHaveBeenCalledWith({ username: "ahmed", hostId: HOST.id, phone: "01012345678" });
  });

  it("answers the same for an unknown username, and saves it for the admin without an account", async () => {
    store.getHostLogin.mockResolvedValue(undefined);
    const result = await requestPasswordReset(null, form({ username: "nobody", phone: "01012345678" }));
    expect(result).toEqual({ ok: true, message: "Request sent. Skyline will contact you on 01012345678 with a temporary password." });
    expect(store.createPasswordRequest).toHaveBeenCalledWith({ username: "nobody", hostId: null, phone: "01012345678" });
  });

  it("checks the form first and saves nothing when it's wrong", async () => {
    expect(await requestPasswordReset(null, form({ username: "", phone: "01012345678" }))).toEqual({ ok: false, message: en.account.errors.requestUsername });
    expect(await requestPasswordReset(null, form({ username: "ahmed", phone: "12" }))).toEqual({ ok: false, message: en.account.errors.requestPhone });
    expect(store.createPasswordRequest).not.toHaveBeenCalled();
  });

  it("allows 3 requests an hour per connection, not counting form mistakes", async () => {
    for (let i = 0; i < 4; i++) await requestPasswordReset(null, form({ username: "ahmed", phone: "1" }));
    for (let i = 0; i < 3; i++) expect((await requestPasswordReset(null, form({ username: "ahmed", phone: "01012345678" })))?.ok).toBe(true);
    const result = await requestPasswordReset(null, form({ username: "ahmed", phone: "01012345678" }));
    expect(result).toEqual({ ok: false, message: fmtMinutes(en.account.errors.tooManyRequests, 60) });
    expect(store.createPasswordRequest).toHaveBeenCalledTimes(3);
  });

  it("reports a storage failure", async () => {
    store.createPasswordRequest.mockRejectedValueOnce(new Error("db down"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    expect(await requestPasswordReset(null, form({ username: "ahmed", phone: "01012345678" }))).toEqual({ ok: false, message: en.account.errors.requestFailed });
  });

  it("doesn't need a signed-in host", async () => {
    hostAuth.currentHost.mockResolvedValue(null);
    expect((await requestPasswordReset(null, form({ username: "ahmed", phone: "01012345678" })))?.ok).toBe(true);
  });
});

describe("admin: dismiss a password request", () => {
  it("closes the request", async () => {
    await dismissPasswordRequest("r1");
    expect(store.resolvePasswordRequest).toHaveBeenCalledWith("r1");
  });

  it("is admin-only", async () => {
    auth.isAdmin.mockResolvedValue(false);
    await expect(dismissPasswordRequest("r1")).rejects.toThrow("REDIRECT /admin/login");
    expect(store.resolvePasswordRequest).not.toHaveBeenCalled();
  });
});

describe("admin: impersonate a host", () => {
  beforeEach(() => {
    store.getHost.mockResolvedValue(HOST);
  });

  it("enters the account with the host's session version, logs it and opens /account", async () => {
    await expect(impersonateHost("h1")).rejects.toThrow("REDIRECT /account");
    expect(store.logImpersonation).toHaveBeenCalledWith("h1");
    // The host's current session version, so a later password change ends this session too.
    expect(hostAuth.startHostSession).toHaveBeenCalledWith("h1", HOST.sessionVersion);
  });

  it("is admin-only", async () => {
    auth.isAdmin.mockResolvedValue(false);
    await expect(impersonateHost("h1")).rejects.toThrow("REDIRECT /admin/login");
    expect(store.logImpersonation).not.toHaveBeenCalled();
    expect(hostAuth.startHostSession).not.toHaveBeenCalled();
  });

  it("doesn't start a session for an account that no longer exists", async () => {
    store.getHost.mockResolvedValueOnce(undefined);
    await expect(impersonateHost("gone")).rejects.toThrow("REDIRECT /admin");
    expect(store.logImpersonation).not.toHaveBeenCalled();
    expect(hostAuth.startHostSession).not.toHaveBeenCalled();
  });

  it("leaves the account by dropping the host session and returning to admin", async () => {
    await expect(stopImpersonating()).rejects.toThrow("REDIRECT /admin");
    expect(hostAuth.endHostSession).toHaveBeenCalled();
  });
});

describe("host accounts: listings", () => {
  const LIVE_PHOTO = "/listings/villa-1.jpg";
  const fields = {
    listingType: "primary",
    title: "Villa in New Cairo",
    type: "villa",
    location: "new-cairo",
    price: "9000000",
    area: "300",
    bedrooms: "4",
    bathrooms: "3",
    sellerType: "owner",
    sellerName: "Ahmed",
    sellerPhone: "+20 100 000 0000",
  };
  const edited = (o: Record<string, string | string[]> = {}) => form({ ...fields, photos: LIVE_PHOTO, ...o });

  beforeEach(() => {
    photos.uploadPhotos.mockResolvedValue(["https://blob.example/properties/photo.jpg"]);
    store.getProperty.mockResolvedValue(makeProperty({ id: "p1", hostId: "h1", status: "published", photos: [LIVE_PHOTO] }));
    store.updateHostProperty.mockResolvedValue(true);
    store.saveHostEdit.mockResolvedValue(true);
  });

  it("files a submission under the signed-in host", async () => {
    expect(await submitProperty(null, form({ ...fields, photos: JPEG }))).toEqual({ ok: true, message: en.msg.submitted });
    expect(store.createProperty).toHaveBeenCalledWith(expect.objectContaining({ hostId: "h1", title: "Villa in New Cairo" }));
  });

  it("refuses a submission once signed out, without uploading anything", async () => {
    hostAuth.currentHost.mockResolvedValue(null);
    expect(await submitProperty(null, form({ ...fields, photos: JPEG }))).toEqual({ ok: false, message: en.account.errors.signInAgain });
    expect(photos.uploadPhotos).not.toHaveBeenCalled();
    expect(store.createProperty).not.toHaveBeenCalled();
  });

  it("holds an edit to a published listing for the admin, leaving the live listing alone", async () => {
    const result = await updateHostProperty("p1", null, edited({ listingType: "resale", featured: "on", purpose: "rent" }));
    expect(result).toEqual({ ok: true, message: en.account.sentForApproval });
    expect(store.updateHostProperty).not.toHaveBeenCalled();
    const [id, hostId, { values, submittedAt }] = store.saveHostEdit.mock.calls[0];
    expect([id, hostId]).toEqual(["p1", "h1"]);
    expect(Date.parse(submittedAt)).not.toBeNaN();
    expect(values).toEqual(expect.objectContaining({ listingType: "resale", title: "Villa in New Cairo", photos: [LIVE_PHOTO] }));
    // Only host-editable fields: never the admin's home-page pick or the purpose.
    expect(values).not.toHaveProperty("featured");
    expect(values).not.toHaveProperty("purpose");
  });

  it("holds a host's unit ranges with the rest of their edit (docs/unit-ranges.md)", async () => {
    expect((await updateHostProperty("p1", null, edited({ areaMax: "400", bedroomsMax: "5" })))?.ok).toBe(true);
    const [, , { values }] = store.saveHostEdit.mock.calls[0];
    expect(values).toEqual(expect.objectContaining({ area: 300, areaMax: 400, bedrooms: 4, bedroomsMax: 5, priceMax: null }));
  });

  it("edits a listing that isn't live yet in place", async () => {
    for (const status of ["pending", "needs_changes"] as const) {
      store.getProperty.mockResolvedValue(makeProperty({ hostId: "h1", status, photos: [LIVE_PHOTO] }));
      expect(await updateHostProperty("p1", null, edited())).toEqual({ ok: true, message: en.account.savedForReview });
    }
    expect(store.updateHostProperty).toHaveBeenCalledTimes(2);
    expect(store.updateHostProperty).toHaveBeenCalledWith("p1", "h1", expect.objectContaining({ title: "Villa in New Cairo" }));
    expect(store.saveHostEdit).not.toHaveBeenCalled();
  });

  it("keeps photos in order, uploading only the new ones", async () => {
    await updateHostProperty("p1", null, edited({ photos: [JPEG, LIVE_PHOTO] }));
    expect(photos.uploadPhotos).toHaveBeenCalledWith([JPEG]);
    expect(store.saveHostEdit.mock.calls[0][2].values.photos).toEqual(["https://blob.example/properties/photo.jpg", LIVE_PHOTO]);
  });

  it("keeps photos from the waiting edit when the host edits it again", async () => {
    const waiting = { values: { ...makeProperty(), photos: ["https://blob.example/properties/waiting.jpg"] }, submittedAt: "2026-10-17T10:00:00.000Z" };
    store.getProperty.mockResolvedValue(makeProperty({ hostId: "h1", status: "published", photos: [LIVE_PHOTO], pendingEdit: waiting }));
    expect((await updateHostProperty("p1", null, edited({ photos: ["https://blob.example/properties/waiting.jpg"] })))?.ok).toBe(true);
    expect(photos.uploadPhotos).not.toHaveBeenCalled();
  });

  it("refuses photos that aren't the listing's own or a downscaled JPEG, and a wrong count", async () => {
    expect(await updateHostProperty("p1", null, edited({ photos: "https://evil.example/x.jpg" }))).toEqual({ ok: false, message: en.msg.photoFailed });
    expect(await updateHostProperty("p1", null, form(fields))).toEqual({ ok: false, message: "Please add between 1 and 8 photos." });
    expect(await updateHostProperty("p1", null, edited({ photos: Array(9).fill(LIVE_PHOTO) }))).toEqual({ ok: false, message: "Please add between 1 and 8 photos." });
    expect(store.saveHostEdit).not.toHaveBeenCalled();
    expect(photos.uploadPhotos).not.toHaveBeenCalled();
  });

  it("refuses when signed out", async () => {
    hostAuth.currentHost.mockResolvedValue(null);
    expect(await updateHostProperty("p1", null, edited())).toEqual({ ok: false, message: en.account.errors.signInAgain });
    expect(store.saveHostEdit).not.toHaveBeenCalled();
  });

  it("refuses someone else's listing, and ones the admin added", async () => {
    for (const hostId of ["h2", null]) {
      store.getProperty.mockResolvedValue(makeProperty({ hostId }));
      expect(await updateHostProperty("p1", null, edited())).toEqual({ ok: false, message: en.msg.unavailable });
    }
    store.getProperty.mockResolvedValue(undefined);
    expect(await updateHostProperty("p1", null, edited())).toEqual({ ok: false, message: en.msg.unavailable });
    expect(store.saveHostEdit).not.toHaveBeenCalled();
    expect(store.updateHostProperty).not.toHaveBeenCalled();
  });

  it("refuses reserved, sold, archived and rejected listings", async () => {
    for (const status of ["reserved", "sold", "archived", "rejected"] as const) {
      store.getProperty.mockResolvedValue(makeProperty({ hostId: "h1", status }));
      expect(await updateHostProperty("p1", null, edited())).toEqual({ ok: false, message: en.account.locked });
    }
    expect(store.saveHostEdit).not.toHaveBeenCalled();
  });

  it("asks to reload when the admin changed the status since the page was opened", async () => {
    store.saveHostEdit.mockResolvedValue(false);
    expect(await updateHostProperty("p1", null, edited())).toEqual({ ok: false, message: en.account.errors.changedMeanwhile });
  });

  it("checks the fields like /submit does", async () => {
    expect(await updateHostProperty("p1", null, edited({ price: "0" }))).toEqual({
      ok: false,
      message: "Price (EGP) must be a whole number from 1 to 1,000,000,000.",
    });
    expect(store.saveHostEdit).not.toHaveBeenCalled();
  });

  it("reports storage failures", async () => {
    store.saveHostEdit.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    expect(await updateHostProperty("p1", null, edited())).toEqual({ ok: false, message: en.msg.saveFailed });
  });
});

describe("admin: host edits waiting for approval", () => {
  const SUBMITTED = "2026-10-17T10:00:00.000Z";
  const waiting = { values: { ...makeProperty(), title: "New title" }, submittedAt: SUBMITTED };

  beforeEach(() => {
    store.getProperty.mockResolvedValue(makeProperty({ hostId: "h1", pendingEdit: waiting }));
    store.approveHostEdit.mockResolvedValue(true);
    store.rejectHostEdit.mockResolvedValue(true);
  });

  it("approves the version the admin was shown", async () => {
    await approveHostEdit("p1", SUBMITTED);
    expect(store.approveHostEdit).toHaveBeenCalledWith("p1", waiting, { result: "approved", note: "", at: expect.any(String) });
  });

  it("leaves a newer edit waiting instead of approving it unseen", async () => {
    await approveHostEdit("p1", "2026-10-17T09:00:00.000Z");
    store.getProperty.mockResolvedValue(makeProperty());
    await approveHostEdit("p1", SUBMITTED);
    expect(store.approveHostEdit).not.toHaveBeenCalled();
  });

  it("rejects with the admin's note for the host", async () => {
    await rejectHostEdit("p1", SUBMITTED, form({ editNote: " Photos are too dark " }));
    expect(store.rejectHostEdit).toHaveBeenCalledWith("p1", SUBMITTED, { result: "rejected", note: "Photos are too dark", at: expect.any(String) });
  });

  it("requires an admin", async () => {
    auth.isAdmin.mockResolvedValue(false);
    await expect(approveHostEdit("p1", SUBMITTED)).rejects.toThrow("REDIRECT /admin/login");
    await expect(rejectHostEdit("p1", SUBMITTED, form({}))).rejects.toThrow("REDIRECT /admin/login");
    expect(store.approveHostEdit).not.toHaveBeenCalled();
    expect(store.rejectHostEdit).not.toHaveBeenCalled();
  });
});

// ---- Sub-locations (docs/sub-locations.md) ----

describe("sub-locations on property forms", () => {
  const fifth = makeSubLocation();
  const lasirena = makeSubLocation({ id: "north-coast--lasirena", locationId: "north-coast", nameEn: "Lasirena", nameAr: "لاسيرينا" });
  const property = (extra: Record<string, string>) =>
    form({
      title: "Nice flat",
      listingType: "resale",
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
      ...extra,
    });

  beforeEach(() => {
    store.getLocations.mockResolvedValue([
      makeLocation({ subLocations: [fifth] }),
      makeLocation({ id: "north-coast", nameEn: "North Coast", nameAr: "الساحل الشمالي", subLocations: [lasirena] }),
    ]);
    photos.uploadPhotos.mockResolvedValue(["https://blob.example/properties/photo.jpg"]);
  });

  it("is optional", async () => {
    expect((await submitProperty(null, property({})))?.ok).toBe(true);
    expect(store.createProperty).toHaveBeenCalledWith(expect.objectContaining({ subLocation: null, subLocationCustom: "" }));
  });

  it("saves a picked sub-location", async () => {
    await submitProperty(null, property({ subLocation: fifth.id }));
    expect(store.createProperty).toHaveBeenCalledWith(expect.objectContaining({ location: "new-cairo", subLocation: fifth.id, subLocationCustom: "" }));
  });

  it("saves typed text under Other", async () => {
    await submitProperty(null, property({ subLocation: "other", subLocationCustom: "Golden Square" }));
    expect(store.createProperty).toHaveBeenCalledWith(expect.objectContaining({ subLocation: null, subLocationCustom: "Golden Square" }));
  });

  it("rejects a sub-location from another location (a tampered form)", async () => {
    expect(await submitProperty(null, property({ subLocation: lasirena.id }))).toEqual({ ok: false, message: en.msg.subLocationChoice });
    expect(store.createProperty).not.toHaveBeenCalled();
  });

  it("saves the admin's choice too", async () => {
    // Typed text naming a listed sub-location becomes it. The admin form redirects on success.
    await expect(createPropertyAdmin(null, property({ purpose: "sale", sellerType: "company", subLocation: "other", subLocationCustom: "fifth settlement" }))).rejects.toThrow("REDIRECT");
    expect(store.createProperty).toHaveBeenCalledWith(expect.objectContaining({ subLocation: fifth.id, subLocationCustom: "" }));
  });
});

describe("approving a host edit with a typed sub-location", () => {
  const SUBMITTED = "2026-10-20T09:00:00.000Z";
  const fifth = makeSubLocation();

  it("turns text the admin has since added to the list into that sub-location", async () => {
    store.getLocations.mockResolvedValue([makeLocation({ subLocations: [fifth] })]);
    const values = { ...makeProperty(), subLocation: null, subLocationCustom: "Fifth Settlement" };
    store.getProperty.mockResolvedValue(makeProperty({ pendingEdit: { values, submittedAt: SUBMITTED } }));
    await approveHostEdit("p1", SUBMITTED);
    expect(store.approveHostEdit).toHaveBeenCalledWith(
      "p1",
      { values: expect.objectContaining({ subLocation: fifth.id, subLocationCustom: "" }), submittedAt: SUBMITTED },
      expect.anything(),
    );
  });

  it("clears a sub-location that no longer fits the edit's location", async () => {
    store.getLocations.mockResolvedValue([makeLocation()]);
    const values = { ...makeProperty(), subLocation: "north-coast--marassi", subLocationCustom: "" };
    store.getProperty.mockResolvedValue(makeProperty({ pendingEdit: { values, submittedAt: SUBMITTED } }));
    await approveHostEdit("p1", SUBMITTED);
    expect(store.approveHostEdit).toHaveBeenCalledWith("p1", { values: expect.objectContaining({ subLocation: null, subLocationCustom: "" }), submittedAt: SUBMITTED }, expect.anything());
  });
});

describe("admin sub-location actions", () => {
  const fifth = makeSubLocation();
  beforeEach(() => {
    store.getLocations.mockResolvedValue([makeLocation({ subLocations: [fifth] })]);
    store.createSubLocation.mockImplementation(async (input: { id: string }) => input.id);
  });

  it("adds a sub-location with an id made from its location and English name", async () => {
    const result = await createSubLocation("new-cairo", null, form({ nameEn: "Madinaty", nameAr: "مدينتي", sortOrder: "50" }));
    expect(result).toEqual({ ok: true, message: en.msg.subLocationAdded });
    expect(store.createSubLocation).toHaveBeenCalledWith({ id: "new-cairo--madinaty", locationId: "new-cairo", slug: "madinaty", nameEn: "Madinaty", nameAr: "مدينتي", sortOrder: 50 });
    expect(store.linkTypedSubLocation).not.toHaveBeenCalled();
  });

  it("moves the properties that typed it onto a sub-location added from the typed panel", async () => {
    await createSubLocation("new-cairo", null, form({ nameEn: "New Narges", nameAr: "النرجس الجديدة", typed: "New  narges" }));
    expect(store.linkTypedSubLocation).toHaveBeenCalledWith("new-cairo", "new narges", "new-cairo--new-narges");
  });

  it("rejects a name the location already has", async () => {
    expect(await createSubLocation("new-cairo", null, form({ nameEn: "fifth settlement", nameAr: "x" }))).toEqual({ ok: false, message: en.msg.subLocationDuplicate });
    expect(store.createSubLocation).not.toHaveBeenCalled();
  });

  it("rejects missing names and unknown locations", async () => {
    expect(await createSubLocation("new-cairo", null, form({ nameEn: "Madinaty" }))).toEqual({ ok: false, message: en.msg.locationMissing });
    expect(await createSubLocation("atlantis", null, form({ nameEn: "A", nameAr: "ب" }))).toEqual({ ok: false, message: en.msg.subLocationSaveFailed });
  });

  it("picks a free slug when the English name's slug is taken", async () => {
    store.getLocations.mockResolvedValue([makeLocation({ subLocations: [makeSubLocation({ id: "new-cairo--madinaty", nameEn: "Madinaty (old)", nameAr: "قديم" })] })]);
    await createSubLocation("new-cairo", null, form({ nameEn: "Madinaty", nameAr: "مدينتي" }));
    expect(store.createSubLocation).toHaveBeenCalledWith(expect.objectContaining({ id: "new-cairo--madinaty-2" }));
  });

  it("keeps the order within bounds", async () => {
    await createSubLocation("new-cairo", null, form({ nameEn: "A", nameAr: "ب", sortOrder: "-5" }));
    expect(store.createSubLocation).toHaveBeenCalledWith(expect.objectContaining({ sortOrder: 0 }));
  });

  it("reports a database failure", async () => {
    store.createSubLocation.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await createSubLocation("new-cairo", null, form({ nameEn: "A", nameAr: "ب" }))).toEqual({ ok: false, message: en.msg.subLocationSaveFailed });
  });

  it("renames and reorders, keeping the id", async () => {
    expect(await updateSubLocation(fifth.id, null, form({ nameEn: "Fifth Settlement", nameAr: "التجمع الخامس", sortOrder: "5" }))).toEqual({ ok: true, message: en.msg.saved });
    expect(store.updateSubLocation).toHaveBeenCalledWith(fifth.id, { nameEn: "Fifth Settlement", nameAr: "التجمع الخامس", sortOrder: 5 });
  });

  it("can't update a sub-location that doesn't exist", async () => {
    expect(await updateSubLocation("new-cairo--atlantis", null, form({ nameEn: "A", nameAr: "ب" }))).toEqual({ ok: false, message: en.msg.subLocationSaveFailed });
  });

  it("hides and restores", async () => {
    await setSubLocationArchived(fifth.id, true);
    expect(store.setSubLocationArchived).toHaveBeenCalledWith(fifth.id, true);
  });

  it("matches typed text to an existing sub-location", async () => {
    expect(await matchTypedSubLocation("new-cairo", "5th settlement", null, form({ subLocation: fifth.id }))).toEqual({ ok: true, message: en.msg.saved });
    expect(store.linkTypedSubLocation).toHaveBeenCalledWith("new-cairo", "5th settlement", fifth.id);
  });

  it("won't match to a sub-location of another location", async () => {
    expect(await matchTypedSubLocation("new-cairo", "x", null, form({ subLocation: "north-coast--marassi" }))).toEqual({ ok: false, message: en.msg.subLocationChoice });
    expect(store.linkTypedSubLocation).not.toHaveBeenCalled();
  });

  it("is admin-only", async () => {
    auth.isAdmin.mockResolvedValue(false);
    await expect(createSubLocation("new-cairo", null, form({ nameEn: "A", nameAr: "ب" }))).rejects.toThrow("REDIRECT /admin/login");
    await expect(setSubLocationArchived(fifth.id, true)).rejects.toThrow("REDIRECT /admin/login");
    await expect(matchTypedSubLocation("new-cairo", "x", null, form({ subLocation: fifth.id }))).rejects.toThrow("REDIRECT /admin/login");
    expect(store.createSubLocation).not.toHaveBeenCalled();
    expect(store.setSubLocationArchived).not.toHaveBeenCalled();
  });
});
