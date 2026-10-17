import { describe, expect, it } from "vitest";
import { makeProperty } from "@/test/fixtures";
import { CODE_PATTERN, isCodeConflict, MAX_CODE_LENGTH, normalizeCode, rentalIds, validCode } from "./property-codes";

describe("normalizeCode", () => {
  it("trims and capitalises, as the property page looks codes up in capitals", () => {
    expect(normalizeCode("  sky-rnt-0101 ")).toBe("SKY-RNT-0101");
    expect(normalizeCode("Villa12")).toBe("VILLA12");
    expect(normalizeCode("")).toBe("");
  });
});

describe("validCode", () => {
  it("accepts English letters and digits in groups joined by single dashes", () => {
    for (const code of ["SKY-RNT-0101", "VILLA12", "NC-A-3", "7", "A".repeat(MAX_CODE_LENGTH)]) expect(validCode(code)).toBe(true);
  });

  it("rejects empty, over-long and non-URL-safe codes", () => {
    for (const code of ["", "A".repeat(MAX_CODE_LENGTH + 1), "SKY RNT", "SKY/1", "SKY_1", "SKY.1", "-SKY", "SKY-", "SKY--1", "كود", "٠١٢", "SKY-#1", "SKY?1"]) {
      expect(validCode(code)).toBe(false);
    }
  });

  it("matches the browser's check of the form field's pattern (anchored, v flag)", () => {
    const browser = new RegExp(`^(?:${CODE_PATTERN})$`, "v");
    for (const code of ["SKY-RNT-0101", "sky-rnt-0101", "7", "SKY RNT", "SKY--1", "-SKY", "كود"]) {
      expect(browser.test(code)).toBe(validCode(normalizeCode(code)));
    }
  });
});

describe("isCodeConflict", () => {
  it("recognises the unique error on properties.code", () => {
    expect(isCodeConflict({ code: "23505", constraint_name: "properties_code_key" })).toBe(true);
  });

  it("ignores other errors", () => {
    expect(isCodeConflict({ code: "23505", constraint_name: "locations_pkey" })).toBe(false);
    expect(isCodeConflict({ code: "08006" })).toBe(false);
    expect(isCodeConflict(new Error("db down"))).toBe(false);
    expect(isCodeConflict(null)).toBe(false);
    expect(isCodeConflict(undefined)).toBe(false);
  });
});

describe("rentalIds", () => {
  it("lists the rentals, whatever their code looks like", () => {
    const properties = [
      makeProperty({ id: "r1", purpose: "rent", code: "VILLA12" }),
      makeProperty({ id: "r2", purpose: "rent", code: "SKY-RNT-0001" }),
      makeProperty({ id: "s1", purpose: "sale", code: "SKY-RES-0001" }),
    ];
    expect([...rentalIds(properties)]).toEqual(["r1", "r2"]);
  });
});
