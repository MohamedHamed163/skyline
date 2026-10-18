import { describe, expect, it } from "vitest";
import ar from "./i18n/ar";
import en from "./i18n/en";
import { whatsappHref } from "./format";
import { COMPANY_DEFAULT_NAME, sellerName, sellerWhatsapp, sellerWithType } from "./sellers";
import { makeProperty } from "@/test/fixtures";

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

describe("sellerWhatsapp", () => {
  const seller = { type: "owner" as const, name: "Mona", phone: "0100 111 2222", whatsapp: "0122 333 4444", company: "" };

  it("sends rentals to Skyline's booking number, whatever the seller gave", () => {
    const rental = makeProperty({ purpose: "rent", seller });
    expect(whatsappHref(sellerWhatsapp(rental))).toBe("https://wa.me/201099900149");
  });

  it("sends sale listings to the seller's WhatsApp, or their phone when there is none", () => {
    expect(sellerWhatsapp(makeProperty({ purpose: "sale", seller }))).toBe("0122 333 4444");
    expect(sellerWhatsapp(makeProperty({ purpose: "sale", seller: { ...seller, whatsapp: "" } }))).toBe("0100 111 2222");
  });
});
