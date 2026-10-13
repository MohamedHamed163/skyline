import { describe, expect, it } from "vitest";
import { makeProperty } from "@/test/fixtures";
import ar from "./i18n/ar";
import en from "./i18n/en";
import {
  countKeys,
  hasRuleIn,
  isMonth,
  isWeekendNight,
  listPrice,
  MAX_PRICE_RULES,
  monthNights,
  monthQuote,
  nightQuote,
  pricedMonths,
  priceLabel,
  priceSpan,
  pricesVary,
  readPriceRules,
  ruleCovering,
  setPriceRule,
  tidyPriceRules,
} from "./pricing";
import type { PriceRule, Property } from "./types";

// Tuesday 13 October 2026. The booking horizon is 31 October 2027. In 2027, 1 April is a Thursday,
// 1 June a Tuesday and 1 August a Sunday.
const TODAY = "2026-10-13";

const rule = (from: string, to: string, price: number, weekendPrice: number | null = null): PriceRule => ({ from, to, price, weekendPrice });
const nightly = (o: Partial<Property> = {}) => makeProperty({ purpose: "rent", rentPeriod: "night", code: "SKY-RNT-0001", price: 3000, ...o });
const monthly = (o: Partial<Property> = {}) => makeProperty({ purpose: "rent", rentPeriod: "month", code: "SKY-RNT-0002", price: 25_000, ...o });
const summer = rule("2027-06-01", "2027-07-31", 8000, 10_000);
/** A rental as cached before weekend and special prices existed: neither key is there. */
const cached = (p: Property): Partial<Property> & Pick<Property, "price" | "purpose" | "rentPeriod"> => {
  const old: Partial<Property> = { ...p };
  delete old.weekendPrice;
  delete old.priceRules;
  return old as Property;
};

describe("weekend nights and months", () => {
  it("counts Thursday and Friday nights as the weekend", () => {
    expect(["2026-10-15", "2026-10-16", "2027-04-01", "2027-04-02"].map(isWeekendNight)).toEqual([true, true, true, true]);
  });

  it("charges every other night as a weekday, Saturday included", () => {
    for (const night of ["2026-10-13", "2026-10-14", "2026-10-17", "2026-10-18", "2026-10-19"]) expect(isWeekendNight(night)).toBe(false);
  });

  it("recognises real months only", () => {
    expect(isMonth("2027-06")).toBe(true);
    for (const v of ["2027-13", "2027-00", "2027-6", "2027-06-01", "", 202706, null]) expect(isMonth(v)).toBe(false);
  });
});

describe("nightQuote", () => {
  const rental = nightly({ weekendPrice: 4500, priceRules: [rule("2027-04-08", "2027-04-10", 12_000), summer] });

  it("charges the standard price on weekdays and the weekend price on Thursday and Friday nights", () => {
    expect(nightQuote(rental, "2026-10-14")).toEqual({ price: 3000, kind: "standard" });
    expect(nightQuote(rental, "2026-10-15")).toEqual({ price: 4500, kind: "weekend" });
    expect(nightQuote(rental, "2026-10-16")).toEqual({ price: 4500, kind: "weekend" });
    expect(nightQuote(rental, "2026-10-17")).toEqual({ price: 3000, kind: "standard" });
  });

  it("charges the standard price on weekends too when there is no weekend price", () => {
    expect(nightQuote(nightly(), "2026-10-15")).toEqual({ price: 3000, kind: "standard" });
  });

  it("lets a special price win, with its own weekend price", () => {
    expect(nightQuote(rental, "2027-06-01")).toEqual({ price: 8000, kind: "special" });
    expect(nightQuote(rental, "2027-06-03")).toEqual({ price: 10_000, kind: "special" });
  });

  it("charges a special price without a weekend price on every night of its run", () => {
    expect(nightQuote(rental, "2027-04-08")).toEqual({ price: 12_000, kind: "special" });
    expect(nightQuote(rental, "2027-04-09")).toEqual({ price: 12_000, kind: "special" });
  });

  it("includes both ends of a run, and nothing after it", () => {
    expect(nightQuote(rental, "2027-07-31").price).toBe(8000);
    expect(nightQuote(rental, "2027-08-01")).toEqual({ price: 3000, kind: "standard" });
  });

  it("reads a rental cached before these prices existed as having none", () => {
    expect(nightQuote(cached(rental), "2026-10-15")).toEqual({ price: 3000, kind: "standard" });
  });
});

describe("monthQuote", () => {
  const rental = monthly({ priceRules: [rule("2027-06", "2027-07", 40_000)] });

  it("charges the standard price outside special months and the special price inside", () => {
    expect(monthQuote(rental, "2027-05")).toEqual({ price: 25_000, kind: "standard" });
    expect(monthQuote(rental, "2027-06")).toEqual({ price: 40_000, kind: "special" });
    expect(monthQuote(rental, "2027-07")).toEqual({ price: 40_000, kind: "special" });
    expect(monthQuote(rental, "2027-08")).toEqual({ price: 25_000, kind: "standard" });
  });
});

describe("prices customers see", () => {
  it("shows a sale listing's plain price", () => {
    const sale = makeProperty({ weekendPrice: 4500 });
    expect(priceSpan(sale, TODAY)).toEqual({ min: 1_000_000, max: 1_000_000 });
    expect(priceLabel(en, sale, TODAY)).toBe("1,000,000 EGP");
  });

  it("shows one price when a rental's price never changes", () => {
    expect(pricesVary(nightly(), TODAY)).toBe(false);
    expect(priceLabel(en, nightly(), TODAY)).toBe("3,000 EGP / night");
    expect(priceLabel(en, monthly(), TODAY)).toBe("25,000 EGP / month");
  });

  it("says From the lowest price when the weekend costs more", () => {
    const rental = nightly({ weekendPrice: 4500 });
    expect(priceSpan(rental, TODAY)).toEqual({ min: 3000, max: 4500 });
    expect(pricesVary(rental, TODAY)).toBe(true);
    expect(priceLabel(en, rental, TODAY)).toBe("From 3,000 EGP / night");
    expect(priceLabel(ar, rental, TODAY)).toBe("من 3,000 ج.م / ليلة");
  });

  it("uses a special price below the standard one as the From price", () => {
    const rental = nightly({ priceRules: [rule("2026-11-01", "2026-11-30", 2000)] });
    expect(listPrice(rental, TODAY)).toBe(2000);
    expect(priceLabel(en, rental, TODAY)).toBe("From 2,000 EGP / night");
  });

  it("covers monthly rentals", () => {
    const rental = monthly({ priceRules: [rule("2027-06", "2027-07", 40_000)] });
    expect(priceSpan(rental, TODAY)).toEqual({ min: 25_000, max: 40_000 });
    expect(priceLabel(en, rental, TODAY)).toBe("From 25,000 EGP / month");
  });

  it("ignores special prices that are over or beyond the calendar", () => {
    const rental = nightly({ priceRules: [rule("2026-09-01", "2026-10-12", 1000), rule("2027-11-01", "2027-11-30", 1000)] });
    expect(pricesVary(rental, TODAY)).toBe(false);
    expect(priceLabel(en, rental, TODAY)).toBe("3,000 EGP / night");
  });

  it("doesn't treat a special price equal to the standard one as a change", () => {
    expect(pricesVary(nightly({ priceRules: [rule("2027-06-01", "2027-06-30", 3000)] }), TODAY)).toBe(false);
  });

  it("works on a rental cached before these prices existed", () => {
    expect(priceLabel(en, cached(nightly({ weekendPrice: 4500 })), TODAY)).toBe("3,000 EGP / night");
  });
});

describe("setPriceRule", () => {
  it("adds a special price for a run of nights, picked in either order", () => {
    expect(setPriceRule([], "night", "2027-06-01", "2027-07-31", 8000, 10_000, TODAY)).toEqual([summer]);
    expect(setPriceRule([], "night", "2027-07-31", "2027-06-01", 8000, 10_000, TODAY)).toEqual([summer]);
  });

  it("splits a run when part of it gets another price", () => {
    expect(setPriceRule([summer], "night", "2027-06-10", "2027-06-20", 9000, null, TODAY)).toEqual([
      rule("2027-06-01", "2027-06-09", 8000, 10_000),
      rule("2027-06-10", "2027-06-20", 9000),
      rule("2027-06-21", "2027-07-31", 8000, 10_000),
    ]);
  });

  it("returns nights to the standard price", () => {
    expect(setPriceRule([summer], "night", "2027-06-10", "2027-06-20", null, null, TODAY)).toEqual([
      rule("2027-06-01", "2027-06-09", 8000, 10_000),
      rule("2027-06-21", "2027-07-31", 8000, 10_000),
    ]);
    expect(setPriceRule([rule("2027-04-08", "2027-04-10", 12_000), summer], "night", "2027-04-01", "2027-08-31", null, null, TODAY)).toEqual([]);
  });

  it("replaces a whole run", () => {
    expect(setPriceRule([summer], "night", "2027-06-01", "2027-07-31", 7000, null, TODAY)).toEqual([rule("2027-06-01", "2027-07-31", 7000)]);
  });

  it("merges touching runs with the same prices, but not different or separate ones", () => {
    const june = setPriceRule([], "night", "2027-06-01", "2027-06-30", 8000, 10_000, TODAY);
    expect(setPriceRule(june, "night", "2027-07-01", "2027-07-31", 8000, 10_000, TODAY)).toEqual([summer]);
    expect(setPriceRule(june, "night", "2027-07-01", "2027-07-31", 8000, null, TODAY)).toHaveLength(2);
    expect(setPriceRule(june, "night", "2027-07-02", "2027-07-31", 8000, 10_000, TODAY)).toHaveLength(2);
  });

  it("drops a weekend price that equals the price, and any weekend price on monthly rentals", () => {
    expect(setPriceRule([], "night", "2027-06-01", "2027-06-30", 8000, 8000, TODAY)).toEqual([rule("2027-06-01", "2027-06-30", 8000)]);
    expect(setPriceRule([], "month", "2027-06", "2027-07", 40_000, 50_000, TODAY)).toEqual([rule("2027-06", "2027-07", 40_000)]);
  });

  it("clips runs to today and the end of the calendar, and drops ones entirely outside", () => {
    expect(setPriceRule([], "night", "2026-10-01", "2026-10-20", 5000, null, TODAY)).toEqual([rule("2026-10-13", "2026-10-20", 5000)]);
    expect(setPriceRule([], "night", "2027-10-20", "2027-12-31", 5000, null, TODAY)).toEqual([rule("2027-10-20", "2027-10-31", 5000)]);
    expect(setPriceRule([], "night", "2026-09-01", "2026-10-12", 5000, null, TODAY)).toEqual([]);
    expect(setPriceRule([], "night", "2027-11-01", "2027-11-30", 5000, null, TODAY)).toEqual([]);
  });

  it("forgets runs that are already over while editing others", () => {
    const old = rule("2026-09-01", "2026-09-30", 5000);
    expect(setPriceRule([old, summer], "night", "2027-04-08", "2027-04-10", 12_000, null, TODAY)).toEqual([rule("2027-04-08", "2027-04-10", 12_000), summer]);
  });

  it("works on months for monthly rentals", () => {
    const highSeason = [rule("2027-06", "2027-08", 40_000)];
    expect(setPriceRule(highSeason, "month", "2027-07", "2027-07", null, null, TODAY)).toEqual([rule("2027-06", "2027-06", 40_000), rule("2027-08", "2027-08", 40_000)]);
    expect(setPriceRule([], "month", "2026-09", "2026-11", 30_000, null, TODAY)).toEqual([rule("2026-10", "2026-11", 30_000)]);
    expect(setPriceRule([], "month", "2027-09", "2027-12", 30_000, null, TODAY)).toEqual([rule("2027-09", "2027-10", 30_000)]);
  });
});

describe("tidyPriceRules", () => {
  it("sorts runs and merges neighbours", () => {
    const july = rule("2027-07-01", "2027-07-31", 8000, 10_000);
    const june = rule("2027-06-01", "2027-06-30", 8000, 10_000);
    expect(tidyPriceRules([july, june], "night", TODAY)).toEqual([summer]);
  });
});

describe("readPriceRules", () => {
  const json = (v: unknown) => JSON.stringify(v);

  it("reads nothing as no special prices", () => {
    expect(readPriceRules("", "night", TODAY)).toEqual([]);
    expect(readPriceRules("  ", "month", TODAY)).toEqual([]);
    expect(readPriceRules("[]", "night", TODAY)).toEqual([]);
  });

  it("reads the form's list", () => {
    expect(readPriceRules(json([summer]), "night", TODAY)).toEqual([summer]);
    expect(readPriceRules(json([{ from: "2027-06", to: "2027-07", price: 40_000 }]), "month", TODAY)).toEqual([rule("2027-06", "2027-07", 40_000)]);
  });

  it("drops runs that are over, sorts the rest and lets later runs win where they overlap", () => {
    const list = [summer, rule("2026-09-01", "2026-09-30", 5000), rule("2027-06-10", "2027-06-20", 9000)];
    expect(readPriceRules(json(list), "night", TODAY)).toEqual([
      rule("2027-06-01", "2027-06-09", 8000, 10_000),
      rule("2027-06-10", "2027-06-20", 9000),
      rule("2027-06-21", "2027-07-31", 8000, 10_000),
    ]);
  });

  it("refuses anything that isn't a list of runs", () => {
    for (const raw of ["not json", "{", json({ from: "2027-06-01" }), json("2027-06-01"), json(7), json([null]), json([["2027-06-01", "2027-06-02", 8000]])]) {
      expect(readPriceRules(raw, "night", TODAY)).toBeNull();
    }
  });

  it(`refuses more than ${MAX_PRICE_RULES} runs`, () => {
    const many = Array.from({ length: MAX_PRICE_RULES + 1 }, (_, i) => rule(`2027-0${1 + Math.floor(i / 28)}-01`, `2027-0${1 + Math.floor(i / 28)}-02`, 5000 + i));
    expect(readPriceRules(json(many), "night", TODAY)).toBeNull();
    expect(readPriceRules(json(many.slice(0, MAX_PRICE_RULES)), "night", TODAY)).not.toBeNull();
  });

  it("refuses impossible nights and keys of the wrong rent period", () => {
    const bad = [
      { from: "2027-02-29", to: "2027-03-01", price: 8000 },
      { from: "2027-06", to: "2027-07", price: 8000 },
      { from: "2027-06-01", price: 8000 },
    ];
    for (const r of bad) expect(readPriceRules(json([r]), "night", TODAY)).toBeNull();
    expect(readPriceRules(json([summer]), "month", TODAY)).toBeNull();
  });

  it("refuses prices that aren't whole numbers from 1 to 1,000,000,000", () => {
    for (const price of [0, -5, 1.5, "8000", null, 1_000_000_001]) {
      expect(readPriceRules(json([{ from: "2027-06-01", to: "2027-06-30", price }]), "night", TODAY)).toBeNull();
    }
    expect(readPriceRules(json([{ from: "2027-06-01", to: "2027-06-30", price: 1_000_000_000 }]), "night", TODAY)).toHaveLength(1);
  });

  it("refuses bad weekend prices, and any weekend price on a monthly rental", () => {
    for (const weekendPrice of [0, 2.5, "10000"]) {
      expect(readPriceRules(json([{ ...summer, weekendPrice }]), "night", TODAY)).toBeNull();
    }
    expect(readPriceRules(json([{ from: "2027-06", to: "2027-07", price: 40_000, weekendPrice: 50_000 }]), "month", TODAY)).toBeNull();
  });
});

describe("selection helpers", () => {
  it("selects a whole month, from today in the current one", () => {
    expect(monthNights("2027-06", TODAY)).toEqual(["2027-06-01", "2027-06-30"]);
    expect(monthNights("2027-02", TODAY)).toEqual(["2027-02-01", "2027-02-28"]);
    expect(monthNights("2026-10", TODAY)).toEqual(["2026-10-13", "2026-10-31"]);
  });

  it("has no nights to select in past months or beyond the calendar", () => {
    expect(monthNights("2026-09", TODAY)).toBeNull();
    expect(monthNights("2027-11", TODAY)).toBeNull();
  });

  it("counts nights and months, both ends included", () => {
    expect(countKeys("night", "2027-06-01", "2027-07-31")).toBe(61);
    expect(countKeys("night", "2027-07-31", "2027-06-01")).toBe(61);
    expect(countKeys("night", "2027-06-01", "2027-06-01")).toBe(1);
    expect(countKeys("month", "2026-11", "2027-02")).toBe(4);
  });

  it("lists this month and the next twelve for monthly rentals", () => {
    const months = pricedMonths(TODAY);
    expect(months).toHaveLength(13);
    expect([months[0], months[2], months[12]]).toEqual(["2026-10", "2026-12", "2027-10"]);
  });

  it("finds the special price covering a whole selection, to fill in the editor", () => {
    const rules = [rule("2027-04-08", "2027-04-10", 12_000), summer];
    expect(ruleCovering(rules, "2027-06-10", "2027-06-20")).toBe(summer);
    expect(ruleCovering(rules, "2027-04-08", "2027-06-02")).toBeUndefined();
    expect(ruleCovering(rules, "2027-05-01", "2027-05-02")).toBeUndefined();
  });

  it("tells whether a selection has any special price to remove", () => {
    expect(hasRuleIn([summer], "2027-05-25", "2027-06-01")).toBe(true);
    expect(hasRuleIn([summer], "2027-08-01", "2027-08-31")).toBe(false);
  });
});
