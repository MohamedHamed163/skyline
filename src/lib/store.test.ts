import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeHost, makeProperty } from "@/test/fixtures";
import { pickHostEdit } from "./listing-edits";

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
    await store.createProperty(makeProperty({ purpose: "rent", weekendPrice: 4500, priceRules: [summer] }));
    expect(written()).toEqual(expect.objectContaining({ weekend_price: 4500, price_rules: { json: [summer] } }));
  });

  it("writes every rental as priced per night, and sale listings with no rent period", async () => {
    await store.createProperty(makeProperty({ purpose: "rent" }));
    expect(written()).toEqual(expect.objectContaining({ rent_period: "night" }));
    await store.createProperty(makeProperty({ purpose: "sale" }));
    expect(written()).toEqual(expect.objectContaining({ rent_period: null }));
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
    await store.createProperty({ ...makeProperty({ purpose: "rent" }), code: "VILLA-12" });
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

describe("host accounts", () => {
  const last = () => db.queries.at(-1)!;
  /** The columns of an INSERT or UPDATE. */
  const columns = (q = last()) => (q.values[0] as { columns: Record<string, unknown> }).columns;
  const hostRow = { id: "h1", username: "ahmed", password_hash: "scrypt$aa$bb", session_version: 2, password_temporary: false, created_at: new Date(0) };
  const HOST = makeHost({ sessionVersion: 2, createdAt: "1970-01-01T00:00:00.000Z" });

  it("reads which account listed a property, and none before the column exists", async () => {
    db.rows = [row({ host_id: "h1" })];
    expect((await store.getProperty("p1"))?.hostId).toBe("h1");
    db.rows = [row()];
    expect((await store.getProperty("p1"))?.hostId).toBeNull();
  });

  it("writes host_id only for a host's submission, so admin additions work before the migration", async () => {
    await store.createProperty({ ...makeProperty(), hostId: "h1" });
    expect(columns()).toEqual(expect.objectContaining({ host_id: "h1" }));
    await store.createProperty(makeProperty());
    expect(columns()).not.toHaveProperty("host_id");
  });

  it("creates an account", async () => {
    const id = await store.createHost({ username: "ahmed", passwordHash: "scrypt$aa$bb" });
    expect(last().text).toContain("INSERT INTO hosts");
    expect(columns()).toEqual({ id, username: "ahmed", password_hash: "scrypt$aa$bb" });
  });

  it("finds an account by username, with its password hash, for signing in", async () => {
    db.rows = [hostRow];
    expect(await store.getHostLogin("ahmed")).toEqual({ host: HOST, passwordHash: "scrypt$aa$bb" });
    expect(last().values).toEqual(["ahmed"]);
    db.rows = [];
    expect(await store.getHostLogin("nobody")).toBeUndefined();
  });

  it("reads the signed-in host, with its session version, without the password hash", async () => {
    db.rows = [{ id: "h1", username: "ahmed", session_version: 3, password_temporary: true, created_at: new Date(0) }];
    expect(await store.getHost("h1")).toEqual({ ...HOST, sessionVersion: 3, temporaryPassword: true });
    expect(last().text).toContain("SELECT id, username, session_version, password_temporary, created_at FROM hosts WHERE id = ");
  });

  it("reads session version 0 and no temporary password from rows without those columns", async () => {
    db.rows = [{ id: "h1", username: "ahmed", password_hash: "scrypt$aa$bb", created_at: new Date(0) }];
    expect((await store.getHostLogin("ahmed"))?.host).toEqual({ ...HOST, sessionVersion: 0, temporaryPassword: false });
  });

  it("changes a password, moving the session version on to sign out every session", async () => {
    db.rows = [{ session_version: 3 }];
    expect(await store.setHostPassword("h1", "scrypt$cc$dd", false)).toBe(3);
    expect(last().text).toContain("UPDATE hosts SET password_hash = ?, password_temporary = ?, session_version = session_version + 1");
    expect(last().text).toContain("WHERE id = ?");
    expect(last().text).toContain("RETURNING session_version");
    expect(last().values).toEqual(["scrypt$cc$dd", false, "h1"]);
    await store.setHostPassword("h1", "scrypt$ee$ff", true);
    expect(last().values).toEqual(["scrypt$ee$ff", true, "h1"]);
  });

  it("says when there is no account to change", async () => {
    db.rows = [];
    expect(await store.setHostPassword("gone", "scrypt$cc$dd", true)).toBeUndefined();
  });

  it("lists a host's listings, newest first", async () => {
    db.rows = [row({ host_id: "h1" })];
    expect((await store.getHostProperties("h1")).map((p) => p.hostId)).toEqual(["h1"]);
    expect(last().text).toContain("WHERE p.host_id = ? ORDER BY p.created_at DESC");
    expect(last().values.at(-1)).toBe("h1");
  });

  it("reads a waiting edit and the admin's last decision, and none before the columns exist", async () => {
    const pendingEdit = { values: { title: "New title" }, submittedAt: "2026-10-17T10:00:00.000Z" };
    const editOutcome = { result: "rejected", note: "Too dark", at: "2026-10-16T10:00:00.000Z" };
    db.rows = [row({ pending_edit: pendingEdit, edit_outcome: editOutcome })];
    expect(await store.getProperty("p1")).toEqual(expect.objectContaining({ pendingEdit, editOutcome }));
    db.rows = [row()];
    expect(await store.getProperty("p1")).toEqual(expect.objectContaining({ pendingEdit: null, editOutcome: null }));
  });
});

describe("host edits", () => {
  const last = () => db.queries.at(-1)!;
  const columns = () => (last().values[0] as { columns: Record<string, unknown> }).columns;
  /** Only what a host can change, as pickHostEdit sends it. */
  const edit = (o: Parameters<typeof makeProperty>[0] = {}) => pickHostEdit(makeProperty({ title: "New title", photos: ["a.jpg", "b.jpg"], ...o }));
  const SUBMITTED = "2026-10-17T10:00:00.000Z";
  const ADMIN_ONLY = ["featured", "purpose", "rent_period", "weekend_price", "price_rules", "admin_notes", "documents", "code", "host_id", "status"];

  it("edits a listing that isn't live yet in place, photos included, and sends it to review", async () => {
    db.rows = [{ id: "p1" }];
    expect(await store.updateHostProperty("p1", "h1", edit())).toBe(true);
    expect(columns()).toEqual(expect.objectContaining({ title: "New title", photos: { json: ["a.jpg", "b.jpg"] }, updated_at: expect.any(Date) }));
    for (const key of ADMIN_ONLY) expect(columns(), key).not.toHaveProperty(key);
    expect(last().text).toContain("previous_status = CASE WHEN status <> 'pending' THEN status ELSE previous_status END");
    expect(last().text).toContain("status = 'pending'");
    expect(last().text).toContain("pending_edit = NULL");
    expect(last().text).toContain("WHERE id = ? AND host_id = ? AND purpose = 'sale' AND status = ANY(?)");
    // Never a published listing: those edits are held (saveHostEdit).
    expect(last().values.slice(1)).toEqual(["p1", "h1", ["pending", "needs_changes"]]);
  });

  it("says when an in-place edit matched nothing (not theirs, or published meanwhile)", async () => {
    db.rows = [];
    expect(await store.updateHostProperty("p1", "h1", edit())).toBe(false);
  });

  it("holds an edit to a published listing without touching the live columns", async () => {
    db.rows = [{ id: "p1" }];
    const pending = { values: edit(), submittedAt: SUBMITTED };
    expect(await store.saveHostEdit("p1", "h1", pending)).toBe(true);
    expect(last().text).toContain("UPDATE properties SET pending_edit = ?, edit_outcome = NULL");
    expect(last().text).not.toContain("updated_at");
    expect(last().text).toContain("WHERE id = ? AND host_id = ? AND purpose = 'sale' AND status = 'published'");
    expect(last().values).toEqual([{ json: pending }, "p1", "h1"]);
    db.rows = [];
    expect(await store.saveHostEdit("p1", "h1", pending)).toBe(false);
  });

  it("approves the version the admin saw: its values become the listing's", async () => {
    db.rows = [{ id: "p1" }];
    const outcome = { result: "approved" as const, note: "", at: SUBMITTED };
    expect(await store.approveHostEdit("p1", { values: edit(), submittedAt: SUBMITTED }, outcome)).toBe(true);
    expect(columns()).toEqual(expect.objectContaining({ title: "New title", photos: { json: ["a.jpg", "b.jpg"] }, updated_at: expect.any(Date) }));
    for (const key of ADMIN_ONLY) expect(columns(), key).not.toHaveProperty(key);
    expect(last().text).toContain("pending_edit = NULL");
    expect(last().text).toContain("WHERE id = ? AND pending_edit->>'submittedAt' = ?");
    expect(last().values.slice(1)).toEqual([{ json: outcome }, "p1", SUBMITTED]);
  });

  it("rejects: discards the edit and keeps the listing", async () => {
    db.rows = [];
    const outcome = { result: "rejected" as const, note: "Too dark", at: SUBMITTED };
    expect(await store.rejectHostEdit("p1", SUBMITTED, outcome)).toBe(false);
    expect(last().text).toContain("UPDATE properties SET pending_edit = NULL, edit_outcome = ?");
    expect(last().text).not.toContain("title");
    expect(last().values).toEqual([{ json: outcome }, "p1", SUBMITTED]);
  });
});

describe("password help", () => {
  const last = () => db.queries.at(-1)!;
  const columns = () => (last().values[0] as { columns: Record<string, unknown> }).columns;

  it("lists every account with its listing count and listing phones, newest first", async () => {
    db.rows = [
      { id: "h1", username: "ahmed", session_version: 1, password_temporary: true, created_at: new Date(0), listings: 2, phones: ["01012345678"] },
      { id: "h2", username: "sara", session_version: 0, password_temporary: false, created_at: new Date(0), listings: 0, phones: null },
    ];
    expect(await store.getHostSummaries()).toEqual([
      { ...makeHost({ sessionVersion: 1, temporaryPassword: true, createdAt: "1970-01-01T00:00:00.000Z" }), listings: 2, phones: ["01012345678"] },
      { ...makeHost({ id: "h2", username: "sara", createdAt: "1970-01-01T00:00:00.000Z" }), listings: 0, phones: [] },
    ]);
    expect(last().text).toContain("FROM hosts h LEFT JOIN properties p ON p.host_id = h.id");
    expect(last().text).toContain("ORDER BY h.created_at DESC");
    // The password hash is never read.
    expect(last().text).not.toContain("password_hash");
  });

  it("saves a request, with or without an account", async () => {
    const id = await store.createPasswordRequest({ username: "ahmed", hostId: "h1", phone: "01012345678" });
    expect(last().text).toContain("INSERT INTO password_requests");
    expect(columns()).toEqual({ id, username: "ahmed", host_id: "h1", phone: "01012345678" });
    await store.createPasswordRequest({ username: "nobody", hostId: null, phone: "01012345678" });
    expect(columns()).toEqual(expect.objectContaining({ host_id: null }));
  });

  it("lists and counts open requests only, newest first", async () => {
    db.rows = [{ id: "r1", username: "ahmed", host_id: null, phone: "0101", created_at: new Date(0) }];
    expect(await store.getPasswordRequests()).toEqual([{ id: "r1", username: "ahmed", hostId: null, phone: "0101", createdAt: "1970-01-01T00:00:00.000Z" }]);
    expect(last().text).toContain("WHERE resolved_at IS NULL ORDER BY created_at DESC");
    db.rows = [{ n: 3 }];
    expect(await store.countPasswordRequests()).toBe(3);
    expect(last().text).toContain("WHERE resolved_at IS NULL");
  });

  it("closes one request, or every open one of an account", async () => {
    await store.resolvePasswordRequest("r1");
    expect(last().text).toContain("UPDATE password_requests SET resolved_at = now() WHERE id = ? AND resolved_at IS NULL");
    expect(last().values).toEqual(["r1"]);
    await store.resolveHostPasswordRequests("h1");
    expect(last().text).toContain("WHERE host_id = ? AND resolved_at IS NULL");
    expect(last().values).toEqual(["h1"]);
  });
});
