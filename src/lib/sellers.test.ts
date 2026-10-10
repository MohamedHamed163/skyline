import { describe, expect, it } from "vitest";
import ar from "./i18n/ar";
import en from "./i18n/en";
import { COMPANY_DEFAULT_NAME, sellerName, sellerWithType } from "./sellers";

describe("sellerName", () => {
  it("shows the site name in the admin's language for Skyline's own listings", () => {
    expect(sellerName(ar, { type: "company", name: COMPANY_DEFAULT_NAME })).toBe(ar.siteName);
    expect(sellerName(en, { type: "company", name: "" })).toBe(en.siteName);
  });

  it("keeps a custom company name and every broker/owner name", () => {
    expect(sellerName(ar, { type: "company", name: "Skyline Sales Team" })).toBe("Skyline Sales Team");
    expect(sellerName(ar, { type: "broker", name: "Skyline" })).toBe("Skyline");
  });
});

describe("sellerWithType", () => {
  it("adds the translated seller type for brokers and owners", () => {
    expect(sellerWithType(ar, { type: "owner", name: "Mona" })).toBe(`Mona (${ar.seller.owner})`);
  });

  it("doesn't repeat the company for Skyline's own listings", () => {
    expect(sellerWithType(en, { type: "company", name: COMPANY_DEFAULT_NAME })).toBe(en.siteName);
  });
});
