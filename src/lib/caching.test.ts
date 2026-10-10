import { describe, expect, it, vi } from "vitest";
import { CACHE_TAGS, PUBLIC_DATA_TTL } from "./cache-tags";

// Which reads are cached across requests (store.ts), and which writes expire them (actions.ts).

type CacheOptions = { tags: string[]; revalidate: number };
const next = vi.hoisted(() => ({
  cached: new Map<string, CacheOptions>(),
}));

vi.mock("next/cache", () => ({
  // Records each cached function under its key and runs it uncached.
  unstable_cache: (fn: (...a: unknown[]) => unknown, keys: string[], options: CacheOptions) => {
    next.cached.set(keys.join("/"), options);
    return fn;
  },
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

const db = vi.hoisted(() => ({ rows: [] as unknown[], queries: 0 }));
vi.mock("./db", () => ({
  sql: () =>
    Object.assign(
      async () => {
        db.queries++;
        return db.rows;
      },
      { json: (v: unknown) => v },
    ),
}));

describe("cached reads (store.ts)", () => {
  it("caches the public lists with tags and a TTL", async () => {
    await import("./store");
    expect(next.cached.get("published-properties")).toEqual({
      tags: [CACHE_TAGS.properties, CACHE_TAGS.locations],
      revalidate: PUBLIC_DATA_TTL,
    });
    expect(next.cached.get("locations")).toEqual({ tags: [CACHE_TAGS.locations], revalidate: PUBLIC_DATA_TTL });
  });

  it("looks up a property by code in the cached list, with no query of its own", async () => {
    const { getPublishedProperties, getPublishedProperty } = await import("./store");
    db.rows = [row("p1", "SKY-RES-0001"), row("p2", "SKY-PRM-0001")];
    db.queries = 0;
    await getPublishedProperties();
    const perListRead = db.queries;

    db.queries = 0;
    expect(await getPublishedProperty("SKY-PRM-0001")).toMatchObject({ id: "p2", code: "SKY-PRM-0001" });
    expect(await getPublishedProperty("SKY-NOPE-9999")).toBeUndefined();
    // Each lookup is exactly one read of the (cached) published list, never a per-code query.
    expect(db.queries).toBe(2 * perListRead);
  });
});

/** A properties row as Postgres returns it. */
function row(id: string, code: string) {
  return { id, code, status: "published", price: "1000000", features: [], photos: [], created_at: new Date(0), updated_at: new Date(0) };
}
