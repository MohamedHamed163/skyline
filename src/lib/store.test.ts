import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeProperty } from "@/test/fixtures";

// Row mapping and writes in store.ts, against a fake `sql` tag that records each query.

const db = vi.hoisted(() => ({ rows: [] as unknown[], queries: [] as { text: string; values: unknown[] }[] }));
vi.mock("./db", () => ({
  sql: () =>
    Object.assign(
      (strings: TemplateStringsArray | Record<string, unknown>, ...values: unknown[]) => {
        // sql(row) is the column-list helper of INSERT and UPDATE: recorded as the row itself.
        if (!Array.isArray(strings)) return { columns: strings };
        db.queries.push({ text: (strings as TemplateStringsArray).join("?"), values });
        return Promise.resolve(db.rows);
      },
      { json: (v: unknown) => ({ json: v }) },
    ),
}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

const store = await import("./store");

/** A properties row as Postgres returns it. */
const row = (o: Record<string, unknown> = {}) => ({
  id: "p1",
  code: "SKY-RNT-0001",
  purpose: "rent",
  rent_period: "night",
  status: "published",
  price: "2000",
  features: [],
  photos: [],
  created_at: new Date(0),
  updated_at: new Date(0),
  ...o,
});

beforeEach(() => {
  db.rows = [];
  db.queries = [];
});

describe("booked days", () => {
  it("reads a rental's booked days", async () => {
    db.rows = [row({ booked_dates: ["2026-10-20", "2026-10-21"] })];
    expect((await store.getProperty("p1"))?.bookedDates).toEqual(["2026-10-20", "2026-10-21"]);
  });

  it("reads no booked days before the column exists", async () => {
    db.rows = [row()];
    expect((await store.getProperty("p1"))?.bookedDates).toEqual([]);
  });

  it("saves the list as JSON without touching Last updated", async () => {
    await store.setBookedDates("p1", ["2026-10-20"]);
    const [query] = db.queries;
    expect(query.text).toContain("UPDATE properties SET booked_dates = ");
    expect(query.text).not.toContain("updated_at");
    expect(query.values).toEqual([{ json: ["2026-10-20"] }, "p1"]);
  });
});

describe("weekend and special prices", () => {
  const summer = { from: "2027-06-01", to: "2027-07-31", price: 8000, weekendPrice: 10_000 };
  /** The columns of the last INSERT or UPDATE. */
  const written = () => (db.queries.at(-1)?.values[0] as { columns: Record<string, unknown> }).columns;

  it("reads the weekend price (a bigint string) as a number, and the special prices", async () => {
    db.rows = [row({ weekend_price: "4500", price_rules: [summer] })];
    const p = await store.getProperty("p1");
    expect(p?.weekendPrice).toBe(4500);
    expect(p?.priceRules).toEqual([summer]);
  });

  it("reads none before the columns exist", async () => {
    db.rows = [row()];
    const p = await store.getProperty("p1");
    expect(p?.weekendPrice).toBeNull();
    expect(p?.priceRules).toEqual([]);
  });

  it("writes both for a nightly rental", async () => {
    await store.createProperty(makeProperty({ purpose: "rent", rentPeriod: "night", weekendPrice: 4500, priceRules: [summer] }));
    expect(written()).toEqual(expect.objectContaining({ weekend_price: 4500, price_rules: { json: [summer] } }));
  });

  it("keeps no weekend price on a monthly rental", async () => {
    const months = [{ from: "2027-06", to: "2027-07", price: 40_000, weekendPrice: null }];
    await store.updateProperty("p1", { ...makeProperty({ purpose: "rent", rentPeriod: "month", weekendPrice: 4500, priceRules: months }), adminNotes: "" });
    expect(written()).toEqual(expect.objectContaining({ weekend_price: null, price_rules: { json: months } }));
  });

  it("clears both on a sale listing", async () => {
    await store.updateProperty("p1", { ...makeProperty({ purpose: "sale", weekendPrice: 4500, priceRules: [summer] }), adminNotes: "" });
    expect(written()).toEqual(expect.objectContaining({ weekend_price: null, price_rules: { json: [] } }));
  });
});
