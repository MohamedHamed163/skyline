import { describe, expect, it } from "vitest";
import { makeProperty } from "@/test/fixtures";
import { CODE_PATTERN, codeFromParam, isCodeConflict, MAX_CODE_LENGTH, normalizeCode, rentalIds, validCode } from "./property-codes";

describe("normalizeCode", () => {
  it("trims and capitalises, as the property page looks codes up in capitals", () => {
    expect(normalizeCode("  rnt-0101 ")).toBe("RNT-0101");
    expect(normalizeCode("Villa12")).toBe("VILLA12");
    expect(normalizeCode("")).toBe("");
  });

  it("keeps Arabic letters and digits as typed, since Arabic has no capitals", () => {
    expect(normalizeCode(" شاليه-٥ ")).toBe("شاليه-٥");
    expect(normalizeCode("فيلا-a1")).toBe("فيلا-A1");
  });

  it("stores the same Arabic code the same way however it was typed (NFC)", () => {
    // آ typed as ا + combining madda becomes the single letter آ.
    expect(normalizeCode("\u0627\u0653ية")).toBe("\u0622ية");
  });
});

describe("validCode", () => {
  it("is limited to 10 characters", () => {
    expect(MAX_CODE_LENGTH).toBe(10);
  });

  it("accepts English or Arabic letters and digits in groups joined by single dashes", () => {
    const codes = ["A101", "VILLA12", "NC-A-3", "7", "شاليه-٥", "فيلا12", "٠١٢٣", "شقة-A-٣", "A".repeat(MAX_CODE_LENGTH), "ش".repeat(MAX_CODE_LENGTH)];
    for (const code of codes) expect(validCode(code)).toBe(true);
  });

  it("counts characters, not bytes, so a 10-letter Arabic code fits", () => {
    expect(validCode("مممممممممم")).toBe(true);
    expect(validCode("ممممممممممم")).toBe(false);
  });

  it("rejects empty, over-long and non-URL-safe codes", () => {
    const codes = [
      "",
      "A".repeat(MAX_CODE_LENGTH + 1),
      "ش".repeat(MAX_CODE_LENGTH + 1),
      "SKY-RNT-0101",
      "SKY RNT",
      "شاليه ٥",
      "SKY/1",
      "SKY_1",
      "SKY.1",
      "-SKY",
      "SKY-",
      "SKY--1",
      "شاليه-",
      "SKY-#1",
      "SKY?1",
      "SKY%1",
      "كود؟",
      "كود،1",
    ];
    for (const code of codes) expect(validCode(code)).toBe(false);
  });

  it("matches the browser's check of the form field's pattern (anchored, v flag)", () => {
    const browser = new RegExp(`^(?:${CODE_PATTERN})$`, "v");
    for (const code of ["RNT-0101", "rnt-0101", "7", "شاليه-٥", "٠١٢", "SKY RNT", "SKY--1", "-SKY", "كود؟", "شاليه ٥"]) {
      expect(browser.test(code)).toBe(validCode(normalizeCode(code)));
    }
  });
});

describe("codeFromParam", () => {
  it("decodes a percent-encoded Arabic code from the web address", () => {
    expect(codeFromParam(encodeURIComponent("شاليه-٥"))).toBe("شاليه-٥");
  });

  it("accepts a code that is already decoded", () => {
    expect(codeFromParam("شاليه-٥")).toBe("شاليه-٥");
  });

  it("capitalises English codes, so /properties/villa12 opens VILLA12", () => {
    expect(codeFromParam("villa12")).toBe("VILLA12");
  });

  it("leaves broken percent-encoding as it is instead of throwing", () => {
    expect(codeFromParam("%E0%A4%A")).toBe("%E0%A4%A");
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
