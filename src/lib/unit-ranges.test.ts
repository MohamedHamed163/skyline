import { describe, expect, it } from "vitest";
import { makeProperty } from "@/test/fixtures";
import { checkRange, hasUnitRanges, isRange, MAX_KEYS, NO_RANGES, RANGE_KEYS, rangeText, storedMax, upper } from "./unit-ranges";

describe("hasUnitRanges", () => {
  it("is only for Primary listings for sale", () => {
    expect(hasUnitRanges({ listingType: "primary", purpose: "sale" })).toBe(true);
    expect(hasUnitRanges({ listingType: "resale", purpose: "sale" })).toBe(false);
    expect(hasUnitRanges({ listingType: "primary", purpose: "rent" })).toBe(false);
  });
});

describe("upper and isRange", () => {
  it("reads the \"to\" value, or the \"from\" when there is none", () => {
    const p = makeProperty({ area: 100, areaMax: 400, bedrooms: 3 });
    expect(upper(p, "area")).toBe(400);
    expect(upper(p, "bedrooms")).toBe(3);
    expect(isRange(p, "area")).toBe(true);
    expect(isRange(p, "bedrooms")).toBe(false);
  });

  it("treats a property cached before ranges existed as having none", () => {
    const cached = Object.fromEntries(Object.entries(makeProperty({ area: 120 })).filter(([k]) => !k.endsWith("Max"))) as Parameters<typeof upper>[0];
    expect(upper(cached, "area")).toBe(120);
    expect(isRange(cached, "price")).toBe(false);
  });

  it("has no floor range when the floor isn't given", () => {
    expect(isRange(makeProperty({ floor: null }), "floor")).toBe(false);
  });
});

describe("rangeText", () => {
  it("shows from – to for a range and one value otherwise", () => {
    expect(rangeText(3, 5)).toBe("3 – 5");
    expect(rangeText(3, null)).toBe("3");
    expect(rangeText(3, 3)).toBe("3");
    expect(rangeText(3, undefined)).toBe("3");
  });

  it("formats each end", () => {
    expect(rangeText(0, 10, (n) => (n === 0 ? "Ground" : String(n)))).toBe("Ground – 10");
  });
});

describe("checkRange and storedMax", () => {
  it("accepts an empty \"to\" or one at least the \"from\"", () => {
    expect(checkRange(3, null)).toBeNull();
    expect(checkRange(3, 3)).toBeNull();
    expect(checkRange(3, 5)).toBeNull();
    expect(checkRange(null, null)).toBeNull();
  });

  it("rejects a \"to\" below the \"from\", or without one", () => {
    expect(checkRange(5, 3)).toBe("toTooSmall");
    expect(checkRange(null, 3)).toBe("noFrom");
  });

  it("stores a \"to\" equal to the \"from\" as no range", () => {
    expect(storedMax(3, 3)).toBeNull();
    expect(storedMax(3, null)).toBeNull();
    expect(storedMax(3, 5)).toBe(5);
  });
});

describe("MAX_KEYS", () => {
  it("names a \"to\" field for every range, all empty in NO_RANGES", () => {
    expect(RANGE_KEYS.map((k) => MAX_KEYS[k]).sort()).toEqual(Object.keys(NO_RANGES).sort());
    expect(Object.values(NO_RANGES).every((v) => v === null)).toBe(true);
  });
});
