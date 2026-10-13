import { createElement as h, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { makeProperty } from "@/test/fixtures";
import ar from "@/lib/i18n/ar";
import { DictProvider } from "@/lib/i18n/client";
import en, { type Dict } from "@/lib/i18n/en";
import type { PriceRule, Property } from "@/lib/types";
import { AvailabilityCalendar } from "./availability-calendar";
import { SpecialPrices } from "./special-prices";

// What the rental price calendars render (docs/rental-pricing.md), as static HTML. Clicking through
// a selection needs a browser; the rules behind it are tested in src/lib/pricing.test.ts.

// Tuesday 13 October 2026. 1 November 2026 is a Sunday.
const TODAY = "2026-10-13";
const november: PriceRule = { from: "2026-11-01", to: "2026-11-30", price: 2000, weekendPrice: null };
const summer: PriceRule = { from: "2027-06", to: "2027-07", price: 40_000, weekendPrice: null };

const render = (el: ReactElement, dict: Dict = en) => renderToStaticMarkup(h(DictProvider, { dict, children: el }));
const unescape = (s: string) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
/** The special prices the form would send. */
const sent = (html: string) => JSON.parse(unescape(html.match(/name="priceRules" value="([^"]*)"/)![1]));

describe("SpecialPrices on the rental form", () => {
  const nightly = (o: { standard?: number; weekend?: number | null; rules?: PriceRule[] } = {}) =>
    render(
      h(SpecialPrices, {
        unit: "night",
        standard: o.standard ?? 3000,
        weekend: o.weekend === undefined ? 4500 : o.weekend,
        defaults: { rentPeriod: "night", priceRules: o.rules ?? [] },
        today: TODAY,
      }),
    );

  it("shows each night's price: standard on weekdays, weekend on Thursday and Friday, special inside a run", () => {
    const html = nightly({ rules: [november] });
    expect(html).toContain('aria-label="Wed, 14 Oct 2026: 3,000 EGP"');
    expect(html).toContain('aria-label="Thu, 15 Oct 2026: 4,500 EGP"');
    expect(html).toContain('aria-label="Fri, 16 Oct 2026: 4,500 EGP"');
    expect(html).toContain('aria-label="Mon, 2 Nov 2026: 2,000 EGP"');
  });

  it("greys out past nights", () => {
    expect(nightly()).toMatch(/<button type="button" disabled="" aria-pressed="false" aria-label="Mon, 12 Oct 2026: 3,000 EGP"/);
  });

  it("lets a month's name select the whole month", () => {
    const html = nightly();
    expect(html).toContain('aria-label="Select all of October 2026"');
    expect(html).toContain('aria-label="Select all of November 2026"');
  });

  it("lists the saved special prices and sends them with the form, dropping ones that are over", () => {
    const html = nightly({ rules: [{ from: "2026-09-01", to: "2026-09-30", price: 9000, weekendPrice: null }, november] });
    expect(html).toContain("Sun, 1 Nov 2026 – Mon, 30 Nov 2026");
    expect(html).toContain("2,000 EGP / night");
    expect(html).not.toContain("9,000");
    expect(sent(html)).toEqual([november]);
  });

  it("names a run's weekend price in the list", () => {
    expect(nightly({ rules: [{ ...november, price: 8000, weekendPrice: 10_000 }] })).toContain("8,000 EGP / night, weekend nights 10,000 EGP");
  });

  it("says when there are none yet, and sends an empty list", () => {
    const html = nightly();
    expect(html).toContain(en.admin.pricing.none.night);
    expect(sent(html)).toEqual([]);
  });

  it("asks for the standard price first while it is empty", () => {
    expect(unescape(nightly({ standard: 0 }))).toContain(en.admin.pricing.standardFirst);
    expect(unescape(nightly())).not.toContain(en.admin.pricing.standardFirst);
  });

  it("keys the legend to standard, weekend and special prices", () => {
    const html = nightly();
    for (const label of [en.admin.pricing.standard, en.admin.pricing.weekend, en.admin.pricing.special]) expect(html).toContain(label);
  });

  it("shows a grid of the next 13 months with their prices on a monthly rental", () => {
    const html = render(h(SpecialPrices, { unit: "month", standard: 25_000, weekend: null, defaults: { rentPeriod: "month", priceRules: [summer] }, today: TODAY }));
    expect(html.match(/aria-label="[A-Z][a-z]+ 20\d\d: [\d,]+ EGP"/g)).toHaveLength(13);
    expect(html).toContain('aria-label="October 2026: 25,000 EGP"');
    expect(html).toContain('aria-label="June 2027: 40,000 EGP"');
    expect(html).toContain('aria-label="October 2027: 25,000 EGP"');
    expect(html).not.toContain(en.admin.pricing.weekend);
    expect(sent(html)).toEqual([summer]);
  });

  it("starts empty when a nightly rental is switched to monthly, without losing its nights", () => {
    const html = render(h(SpecialPrices, { unit: "month", standard: 25_000, weekend: null, defaults: { rentPeriod: "night", priceRules: [november] }, today: TODAY }));
    expect(sent(html)).toEqual([]);
  });

  it("works in Arabic", () => {
    const html = render(h(SpecialPrices, { unit: "night", standard: 3000, weekend: null, defaults: { rentPeriod: "night", priceRules: [november] }, today: TODAY }), ar);
    expect(html).toContain(ar.admin.pricing.title);
    expect(html).toContain("2,000 ج.م / ليلة");
  });
});

describe("AvailabilityCalendar prices on the property page", () => {
  const calendar = (o: Partial<Property>, booked: string[] = []) =>
    render(h(AvailabilityCalendar, { booked, today: TODAY, pricing: makeProperty({ purpose: "rent", rentPeriod: "night", price: 3000, ...o }) }));

  it("shows each free night's price when the price changes by date", () => {
    const html = calendar({ weekendPrice: 4500 }, ["2026-10-16"]);
    expect(html).toContain("Wed, 14 Oct 2026, available, 3,000 EGP");
    expect(html).toContain("Thu, 15 Oct 2026, available, 4,500 EGP");
    expect(html).toContain("Fri, 16 Oct 2026, booked");
    expect(html).not.toContain("Fri, 16 Oct 2026, available");
  });

  it("shows no prices on the days when there is only one price", () => {
    const html = calendar({});
    expect(html).toContain("Wed, 14 Oct 2026, available<");
    expect(html).not.toContain("3,000");
  });

  it("shows each month's price under its name on a monthly rental", () => {
    const html = calendar({ rentPeriod: "month", price: 25_000, priceRules: [summer] });
    expect(html).toContain("25,000 EGP / month");
    expect(html).toContain("Wed, 14 Oct 2026, available<");
  });
});
