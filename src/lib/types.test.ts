import { describe, expect, it } from "vitest";
import { LISTING_TYPES, toListingType } from "./types";

describe("toListingType", () => {
  it("accepts the current listing types", () => {
    expect(LISTING_TYPES).toEqual(["primary", "resale"]);
    for (const v of LISTING_TYPES) expect(toListingType(v)).toBe(v);
  });

  it("reads the old name premium as primary", () => {
    expect(toListingType("premium")).toBe("primary");
  });

  it("rejects anything else", () => {
    for (const v of ["", "Primary", "gold", "all", undefined, null, 1]) expect(toListingType(v)).toBeUndefined();
  });
});
