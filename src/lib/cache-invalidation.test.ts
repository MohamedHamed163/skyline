import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeLocation, makeProperty } from "@/test/fixtures";
import { cairoToday } from "./availability";
import { CACHE_TAGS } from "./cache-tags";
import en from "./i18n/en";

// Every admin write that changes what the public site shows must expire the matching cache tag.

const updateTag = vi.hoisted(() => vi.fn());
const store = vi.hoisted(() => ({
  getLocations: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
  setLocationArchived: vi.fn(),
  createProperty: vi.fn(),
  updateProperty: vi.fn(),
  setPropertyStatus: vi.fn(),
  createLead: vi.fn(),
  getProperty: vi.fn(),
  updateLead: vi.fn(),
  setBookedDates: vi.fn(),
}));

vi.mock("./store", () => store);
vi.mock("./auth", () => ({ isAdmin: async () => true, checkPassword: vi.fn(), startSession: vi.fn(), endSession: vi.fn() }));
vi.mock("./photos", () => ({ uploadPhotos: async () => ["https://blob.example/p.jpg"] }));
vi.mock("./i18n", async () => ({ ...(await import("./i18n/shared")), getDict: async () => en, isLocale: () => true, LOCALE_COOKIE: "lang" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag }));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

const actions = await import("./actions");

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
  store.getLocations.mockResolvedValue([makeLocation()]);
  store.getProperty.mockResolvedValue(makeProperty({ status: "published" }));
});

describe("cache invalidation", () => {
  it("expires properties when a property's status changes", async () => {
    await actions.setPropertyStatus("p1", "published");
    expect(updateTag).toHaveBeenCalledWith(CACHE_TAGS.properties);
  });

  it("expires properties when changes are requested", async () => {
    await actions.requestChanges("p1", form({ adminNotes: "Fix the price" }));
    expect(updateTag).toHaveBeenCalledWith(CACHE_TAGS.properties);
  });

  it("expires properties when a rental's booked days change", async () => {
    store.getProperty.mockResolvedValue(makeProperty({ purpose: "rent" }));
    const today = cairoToday();
    expect(await actions.setBookedDays("p1", today, today, true)).toEqual({ ok: true, days: [today] });
    expect(updateTag).toHaveBeenCalledWith(CACHE_TAGS.properties);
  });

  it("expires locations on create, update and hide", async () => {
    await actions.createLocation(null, form({ nameEn: "El Shorouk", nameAr: "الشروق" }));
    await actions.updateLocation("new-cairo", null, form({ nameEn: "New Cairo City", nameAr: "القاهرة الجديدة" }));
    await actions.setLocationArchived("new-cairo", true);
    expect(updateTag.mock.calls).toEqual([[CACHE_TAGS.locations], [CACHE_TAGS.locations], [CACHE_TAGS.locations]]);
  });

  it("leaves the public cache alone for writes the public can't see", async () => {
    await actions.submitLead(null, form({ propertyId: "p1", name: "Mona", phone: "01012345678" }));
    await actions.updateLead("l1", form({ status: "contacted", notes: "" }));
    expect(updateTag).not.toHaveBeenCalled();
  });
});
