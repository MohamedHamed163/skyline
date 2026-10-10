import { describe, expect, it } from "vitest";
import { caretAfterDigits, checkWholeNumber, counterTone, TEXT_LIMITS, digitsOnly, groupDigits, maxDigits, PROPERTY_LIMITS, toLatinDigits, validEmail, validPhone } from "./validation";

describe("checkWholeNumber", () => {
  const limits = { min: 1, max: 5_000 };

  it("accepts whole numbers inside the range, including both ends", () => {
    expect(checkWholeNumber("1", limits)).toBeNull();
    expect(checkWholeNumber("250", limits)).toBeNull();
    expect(checkWholeNumber("5000", limits)).toBeNull();
  });

  it("rejects values outside the range", () => {
    expect(checkWholeNumber("0", limits)).toBe("tooSmall");
    expect(checkWholeNumber("5001", limits)).toBe("tooLarge");
    expect(checkWholeNumber("99999999999999999999", limits)).toBe("tooLarge");
  });

  it("rejects anything that isn't plain digits", () => {
    for (const v of ["12.5", "-3", "1e3", "abc", "1,000"]) expect(checkWholeNumber(v, limits)).toBe("notNumber");
  });

  it("treats empty as required unless the field is optional", () => {
    expect(checkWholeNumber("", limits)).toBe("required");
    expect(checkWholeNumber("  ", limits)).toBe("required");
    expect(checkWholeNumber("", limits, false)).toBeNull();
  });

  it("caps price at one billion and area at 5,000", () => {
    expect(checkWholeNumber("1000000000", PROPERTY_LIMITS.price)).toBeNull();
    expect(checkWholeNumber("1000000001", PROPERTY_LIMITS.price)).toBe("tooLarge");
    expect(checkWholeNumber("5001", PROPERTY_LIMITS.area)).toBe("tooLarge");
    expect(checkWholeNumber("0", PROPERTY_LIMITS.bedrooms)).toBeNull();
    expect(checkWholeNumber("51", PROPERTY_LIMITS.bathrooms)).toBe("tooLarge");
  });
});

describe("digit input helpers", () => {
  it("converts Arabic-Indic and Persian digits", () => {
    expect(toLatinDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
    expect(toLatinDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
    expect(toLatinDigits("a1")).toBe("a1");
  });

  it("keeps only digits and drops leading zeros", () => {
    expect(digitsOnly("1,250,000 EGP")).toBe("1250000");
    expect(digitsOnly("-12.5e3")).toBe("1253");
    expect(digitsOnly("٣٠٠")).toBe("300");
    expect(digitsOnly("007")).toBe("7");
    expect(digitsOnly("0")).toBe("0");
    expect(digitsOnly("")).toBe("");
  });

  it("knows how many digits a range allows", () => {
    expect(maxDigits(PROPERTY_LIMITS.price)).toBe(10);
    expect(maxDigits(PROPERTY_LIMITS.area)).toBe(4);
  });

  it("groups digits with commas", () => {
    expect(groupDigits("")).toBe("");
    expect(groupDigits("999")).toBe("999");
    expect(groupDigits("1000")).toBe("1,000");
    expect(groupDigits("1000000000")).toBe("1,000,000,000");
  });

  it("finds the caret position after the n-th digit", () => {
    expect(caretAfterDigits("1,234,567", 0)).toBe(0);
    expect(caretAfterDigits("1,234,567", 1)).toBe(1);
    expect(caretAfterDigits("1,234,567", 2)).toBe(3);
    expect(caretAfterDigits("1,234,567", 7)).toBe(9);
    expect(caretAfterDigits("1,234", 9)).toBe(5);
  });
});

describe("contact fields", () => {
  it("validates phones and emails", () => {
    expect(validPhone("+20 100 000 0000")).toBe(true);
    expect(validPhone("123")).toBe(false);
    expect(validEmail("a@b.co")).toBe(true);
    expect(validEmail("a@b")).toBe(false);
  });
});

describe("counterTone", () => {
  it("is normal below 90%, near from 90% and full at the limit", () => {
    expect(counterTone(0, TEXT_LIMITS.title)).toBe("normal");
    expect(counterTone(107, TEXT_LIMITS.title)).toBe("normal");
    expect(counterTone(108, TEXT_LIMITS.title)).toBe("near");
    expect(counterTone(119, TEXT_LIMITS.title)).toBe("near");
    expect(counterTone(120, TEXT_LIMITS.title)).toBe("full");
    expect(counterTone(1800, TEXT_LIMITS.description)).toBe("near");
  });
});
