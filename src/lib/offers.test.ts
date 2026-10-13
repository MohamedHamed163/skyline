import { describe, expect, it } from "vitest";
import ar from "./i18n/ar";
import en from "./i18n/en";
import { OFFERS, formatRate, offerDetails } from "./offers";
import { LISTING_TYPES } from "./types";

const primary = OFFERS.find((o) => o.listing === "primary")!;
const resale = OFFERS.find((o) => o.listing === "resale")!;
const highlightText = (h: { before: string; figure: string; after: string }) => [h.before, h.figure, h.after].filter(Boolean).join(" ");

describe("OFFERS", () => {
  it("has one offer per listing type, Primary first", () => {
    expect(OFFERS.map((o) => o.listing)).toEqual([...LISTING_TYPES]);
  });

  it("gives 1% cashback on Primary and charges 0.5% commission on Resale", () => {
    expect(primary.rate).toBe(1);
    expect(resale.rate).toBe(0.5);
  });
});

describe("formatRate", () => {
  it("writes the rate as a percentage", () => {
    expect(formatRate(1)).toBe("1%");
    expect(formatRate(0.5)).toBe("0.5%");
  });
});

describe("offerDetails", () => {
  it("builds the approved English copy for Primary", () => {
    const o = offerDetails(en, primary);
    expect(o.headline).toBe("Buy Primary. Get 1% Cashback.");
    expect(o.text).toBe("Purchase a primary-market property through Skyline and receive 1% cashback.");
    expect(o.highlight).toEqual({ before: "", figure: "1%", after: "cashback" });
    // The card sets the highlight in capitals.
    expect(highlightText(o.highlight).toUpperCase()).toBe("1% CASHBACK");
  });

  it("builds the approved English copy for Resale", () => {
    const o = offerDetails(en, resale);
    expect(o.headline).toBe("Buy or Sell Resale with Just 0.5% Commission.");
    expect(o.text).toBe("Skyline charges only 0.5% commission on resale transactions.");
    expect(o.highlight).toEqual({ before: "Only", figure: "0.5%", after: "commission" });
    expect(highlightText(o.highlight).toUpperCase()).toBe("ONLY 0.5% COMMISSION");
  });

  it("keeps the Arabic word order around the figure", () => {
    expect(offerDetails(ar, primary).highlight).toEqual({ before: "", figure: "1%", after: "كاش باك" });
    expect(offerDetails(ar, resale).highlight).toEqual({ before: "عمولة", figure: "0.5%", after: "فقط" });
  });

  it("links each offer to its listings", () => {
    expect(offerDetails(en, primary).href).toBe("/properties?listing=primary");
    expect(offerDetails(en, resale).href).toBe("/properties?listing=resale");
  });

  it.each([
    ["en", en],
    ["ar", ar],
  ])("fills the rate into every %s string", (_, t) => {
    for (const offer of OFFERS) {
      const copy = t.home.offers[offer.listing];
      // The highlight is split on {rate}, so it must appear exactly once.
      expect(copy.highlight.split("{rate}")).toHaveLength(2);
      const o = offerDetails(t, offer);
      for (const s of [o.headline, o.text]) {
        expect(s).toContain(formatRate(offer.rate));
        expect(s).not.toContain("{");
      }
    }
  });
});
