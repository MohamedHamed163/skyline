import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeHost, makeProperty } from "@/test/fixtures";
import type { Host } from "./types";
import { signSession } from "./passwords";

// The host-session cookie with Next's cookie jar and the store mocked.

const jar = vi.hoisted(() => {
  const values = new Map<string, { value: string; options?: Record<string, unknown> }>();
  return {
    values,
    get: (name: string) => (values.has(name) ? { name, value: values.get(name)!.value } : undefined),
    has: (name: string) => values.has(name),
    set: (name: string, value: string, options?: Record<string, unknown>) => void values.set(name, { value, options }),
    delete: (name: string) => void values.delete(name),
  };
});
const store = vi.hoisted(() => ({ getHost: vi.fn(), getProperty: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => jar }));
vi.mock("./store", () => store);

const auth = await import("./host-auth");

/** The account as the database has it now; tests move its session version on. */
let HOST: Host;

beforeEach(() => {
  jar.values.clear();
  vi.clearAllMocks();
  vi.stubEnv("SESSION_SECRET", "test-secret");
  HOST = makeHost({ sessionVersion: 2 });
  store.getHost.mockImplementation(async (id: string) => (id === HOST.id ? HOST : undefined));
});

afterEach(() => vi.unstubAllEnvs());

// currentHostId and currentHost are wrapped in React's cache(), which doesn't memoize outside a
// server render, so each call below reads the cookie again.

describe("host sessions", () => {
  it("signs a host in for 30 days with an http-only cookie and remembers the browser", async () => {
    await auth.startHostSession("h1", 2);
    const session = jar.values.get("skyline_host")!;
    expect(session.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    expect(session.value).toMatch(/^h1\.2\./);
    expect(await auth.currentHostId()).toBe("h1");
    expect(await auth.currentHost()).toEqual(HOST);
    expect(await auth.knownHost()).toBe(true);
  });

  it("signs out but keeps remembering the browser, so /submit offers Sign in", async () => {
    await auth.startHostSession("h1", 2);
    await auth.endHostSession();
    expect(await auth.currentHostId()).toBeNull();
    expect(await auth.currentHost()).toBeNull();
    expect(await auth.knownHost()).toBe(true);
  });

  it("ignores forged and expired cookies", async () => {
    jar.set("skyline_host", signSession({ hostId: "h1", version: 2 }, Date.now() + 60_000, "another-secret"));
    expect(await auth.currentHostId()).toBeNull();
    jar.set("skyline_host", signSession({ hostId: "h1", version: 2 }, Date.now() - 1, "test-secret"));
    expect(await auth.currentHostId()).toBeNull();
    expect(store.getHost).not.toHaveBeenCalled();
  });

  it("treats a deleted account as signed out", async () => {
    await auth.startHostSession("gone", 0);
    expect(await auth.currentHost()).toBeNull();
  });

  it("ends sessions started before a password change", async () => {
    await auth.startHostSession("h1", 2);
    HOST = makeHost({ sessionVersion: 3 }); // changed in another browser, or reset by the admin
    expect(await auth.currentHost()).toBeNull();
    // The navbar only checks the signature, so it still shows My account until a page loads the account.
    expect(await auth.currentHostId()).toBe("h1");
    // The browser that changed it got a cookie with the new version.
    await auth.startHostSession("h1", 3);
    expect(await auth.currentHost()).toEqual(HOST);
  });

  it("is turned off without a signing secret", async () => {
    vi.stubEnv("SESSION_SECRET", "");
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(auth.hostSessionsEnabled()).toBe(false);
    vi.stubEnv("ADMIN_PASSWORD", "admin-pass");
    expect(auth.hostSessionsEnabled()).toBe(true);
  });

  it("is new to a browser that never signed up or in", async () => {
    expect(await auth.knownHost()).toBe(false);
  });
});

describe("ownListing", () => {
  it("returns the host's own listing", async () => {
    await auth.startHostSession("h1", 2);
    store.getProperty.mockResolvedValue(makeProperty({ id: "p1", hostId: "h1" }));
    expect(await auth.ownListing("p1")).toEqual({ host: HOST, property: expect.objectContaining({ id: "p1" }) });
  });

  it("hides other hosts' listings and admin-added ones", async () => {
    await auth.startHostSession("h1", 2);
    store.getProperty.mockResolvedValue(makeProperty({ hostId: "h2" }));
    expect((await auth.ownListing("p1")).property).toBeUndefined();
    store.getProperty.mockResolvedValue(makeProperty({ hostId: null }));
    expect((await auth.ownListing("p1")).property).toBeUndefined();
  });

  it("has no host when signed out, without reading the listing", async () => {
    expect(await auth.ownListing("p1")).toEqual({ host: null, property: undefined });
    expect(store.getProperty).not.toHaveBeenCalled();
  });
});
