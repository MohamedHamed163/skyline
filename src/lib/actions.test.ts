import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeLocation } from "@/test/fixtures";
import en from "./i18n/en";

// Server actions with the database, auth, uploads and Next.js runtime mocked out.

const store = vi.hoisted(() => ({
  getLocations: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
  setLocationArchived: vi.fn(),
  createProperty: vi.fn(),
}));
const auth = vi.hoisted(() => ({ isAdmin: vi.fn() }));
const photos = vi.hoisted(() => ({ uploadPhotos: vi.fn() }));
const nav = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

vi.mock("./store", () => store);
vi.mock("./auth", () => ({ ...auth, checkPassword: vi.fn(), startSession: vi.fn(), endSession: vi.fn() }));
vi.mock("./photos", () => photos);
vi.mock("./i18n", async () => ({ ...(await import("./i18n/shared")), getDict: async () => en, isLocale: () => true, LOCALE_COOKIE: "lang" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => nav);

const { createLocation, setLocationArchived, submitProperty, updateLocation } = await import("./actions");

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
