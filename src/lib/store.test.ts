import { beforeEach, describe, expect, it, vi } from "vitest";

// Row mapping and writes in store.ts, against a fake `sql` tag that records each query.

const db = vi.hoisted(() => ({ rows: [] as unknown[], queries: [] as { text: string; values: unknown[] }[] }));
vi.mock("./db", () => ({
  sql: () =>
    Object.assign(
      async (strings: TemplateStringsArray, ...values: unknown[]) => {
        db.queries.push({ text: strings.join("?"), values });
        return db.rows;
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
