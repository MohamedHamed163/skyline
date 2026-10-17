import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeProperty } from "@/test/fixtures";

// Row mapping and writes in store.ts, against a fake `sql` tag that records each query.

// errors: thrown by the next queries, in order (e.g. a unique-constraint error).
const db = vi.hoisted(() => ({ rows: [] as unknown[], queries: [] as { text: string; values: unknown[] }[], errors: [] as unknown[] }));
vi.mock("./db", () => ({
  sql: () =>
    Object.assign(
      (strings: TemplateStringsArray | Record<string, unknown>, ...values: unknown[]) => {
        // sql(row) is the column-list helper of INSERT and UPDATE: recorded as the row itself.
        if (!Array.isArray(strings)) return { columns: strings };
        db.queries.push({ text: (strings as TemplateStringsArray).join("?"), values });
        const error = db.errors.shift();
        return error ? Promise.reject(error) : Promise.resolve(db.rows);
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
  db.errors = [];
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

describe("property codes", () => {
  /** The columns of the last INSERT. */
  const written = () => (db.queries.at(-1)?.values[0] as { columns: Record<string, unknown> }).columns;
  const conflict = Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505", constraint_name: "properties_code_key" });

  it("saves the code the admin typed for a new rental", async () => {
    await store.createProperty({ ...makeProperty({ purpose: "rent", rentPeriod: "night" }), code: "VILLA-12" });
    expect(written()).toEqual(expect.objectContaining({ code: "VILLA-12" }));
  });

  it("saves no code when none is given, so publishing issues one", async () => {
    await store.createProperty(makeProperty({ code: null }));
    expect(written()).toEqual(expect.objectContaining({ code: null }));
  });

  it("looks a code up across all properties", async () => {
    db.rows = [{ "?column?": 1 }];
    expect(await store.codeTaken("VILLA-12")).toBe(true);
    expect(db.queries[0].text).toContain("SELECT 1 FROM properties WHERE code = ");
    expect(db.queries[0].values).toEqual(["VILLA-12"]);
    db.rows = [];
    expect(await store.codeTaken("VILLA-13")).toBe(false);
  });

  it("issues codes on publishing, keeping one that is already set", async () => {
    await store.setPropertyStatus("p1", "published");
    expect(db.queries).toHaveLength(1);
    expect(db.queries[0].text).toContain("code = COALESCE(code, CASE");
    expect(db.queries[0].text).toContain("nextval('property_code_resale')");
  });

  it("skips sequence numbers already used by a code the admin typed", async () => {
    db.errors = [conflict, conflict];
    await store.setPropertyStatus("p1", "published");
    expect(db.queries).toHaveLength(3);
  });

  it("gives up after 10 taken numbers", async () => {
    db.errors = Array(10).fill(conflict);
    await expect(store.setPropertyStatus("p1", "published")).rejects.toBe(conflict);
    expect(db.queries).toHaveLength(10);
  });

  it("doesn't retry other errors", async () => {
    const down = new Error("db down");
    db.errors = [down];
    await expect(store.setPropertyStatus("p1", "published")).rejects.toBe(down);
    expect(db.queries).toHaveLength(1);
  });
});
