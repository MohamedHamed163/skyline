import { describe, expect, it } from "vitest";
import { makeLocation } from "@/test/fixtures";
import { localName, locationLabel, selectableLocations, slugify, uniqueSlug, validateLocation } from "./locations";

const en = { locale: "en" };
const ar = { locale: "ar" };

describe("slugify", () => {
  it("turns an English name into a URL slug", () => {
    expect(slugify("New Cairo")).toBe("new-cairo");
    expect(slugify("  6th of October City ")).toBe("6th-of-october-city");
    expect(slugify("Ain Sokhna / Galala")).toBe("ain-sokhna-galala");
  });

  it("strips accents", () => {
    expect(slugify("Montazah Café")).toBe("montazah-cafe");
  });

  it("falls back when nothing Latin is left", () => {
    expect(slugify("الشيخ زايد")).toBe("location");
    expect(slugify("---")).toBe("location");
  });

  it("caps the length without a trailing dash", () => {
    const slug = slugify(`${"a".repeat(49)} bcd`);
    expect(slug.length).toBeLessThanOrEqual(50);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("uniqueSlug", () => {
  it("keeps a free slug", () => {
    expect(uniqueSlug("giza", ["new-cairo"])).toBe("giza");
  });

  it("adds the first free number suffix", () => {
    expect(uniqueSlug("giza", ["giza"])).toBe("giza-2");
    expect(uniqueSlug("giza", ["giza", "giza-2", "giza-3"])).toBe("giza-4");
  });
});

describe("validateLocation", () => {
  const existing = [makeLocation(), makeLocation({ id: "giza", nameEn: "Giza", nameAr: "الجيزة", archived: true })];

  it("requires both names", () => {
    expect(validateLocation({ nameEn: "", nameAr: "الشروق" }, existing)).toBe("missing");
    expect(validateLocation({ nameEn: "El Shorouk", nameAr: "" }, existing)).toBe("missing");
  });

  it("accepts a new location", () => {
    expect(validateLocation({ nameEn: "El Shorouk", nameAr: "الشروق" }, existing)).toBeNull();
  });

  it("rejects a duplicate English name, ignoring case and spaces", () => {
    expect(validateLocation({ nameEn: " new cairo ", nameAr: "أخرى" }, existing)).toBe("duplicate");
  });

  it("rejects a duplicate Arabic name", () => {
    expect(validateLocation({ nameEn: "Other", nameAr: "القاهرة الجديدة" }, existing)).toBe("duplicate");
  });

  it("counts hidden locations as duplicates (restore them instead)", () => {
    expect(validateLocation({ nameEn: "Giza", nameAr: "جيزة" }, existing)).toBe("duplicate");
  });

  it("lets a location keep its own name when edited", () => {
    expect(validateLocation({ nameEn: "New Cairo", nameAr: "القاهرة الجديدة" }, existing, "new-cairo")).toBeNull();
  });
});

describe("names", () => {
  const loc = makeLocation();

  it("picks the name for the current language", () => {
    expect(locationLabel(en, loc)).toBe("New Cairo");
    expect(locationLabel(ar, loc)).toBe("القاهرة الجديدة");
  });

  it("falls back to English when the Arabic name is empty", () => {
    expect(localName(ar, { en: "Giza", ar: "" })).toBe("Giza");
  });
});

describe("selectableLocations", () => {
  const active = makeLocation();
  const hidden = makeLocation({ id: "giza", archived: true });

  it("drops hidden locations", () => {
    expect(selectableLocations([active, hidden])).toEqual([active]);
  });

  it("keeps the hidden location a property is already on", () => {
    expect(selectableLocations([active, hidden], "giza")).toEqual([active, hidden]);
  });
});
