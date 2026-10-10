import { describe, expect, it, vi } from "vitest";

// unstable_rethrow re-throws Next.js control-flow errors (redirect, notFound) and ignores the rest.
vi.mock("next/navigation", () => ({
  unstable_rethrow: (err: unknown) => {
    if (err instanceof Error && err.message.startsWith("NEXT_REDIRECT")) throw err;
  },
}));

const { succeeded, withFailureMessage } = await import("./safe-action");

describe("withFailureMessage", () => {
  const fd = new FormData();

  it("passes the action's result through", async () => {
    const action = vi.fn(async () => ({ ok: false, message: "Bad price" }));
    expect(await withFailureMessage(action, "Offline")(null, fd)).toEqual({ ok: false, message: "Bad price" });
    expect(action).toHaveBeenCalledWith(null, fd);
  });

  it("turns a failed request into an error message instead of throwing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const action = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await withFailureMessage(action, "Offline")(null, fd)).toEqual({ ok: false, message: "Offline" });
  });

  it("lets redirects through", async () => {
    const action = vi.fn(async () => {
      throw new Error("NEXT_REDIRECT;/admin/properties/p1");
    });
    await expect(withFailureMessage(action, "Offline")(null, fd)).rejects.toThrow("NEXT_REDIRECT");
  });
});

describe("succeeded", () => {
  it("is true when the action finishes", async () => {
    expect(await succeeded(async () => undefined)).toBe(true);
  });

  it("is false when the request fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      await succeeded(async () => {
        throw new TypeError("Failed to fetch");
      }),
    ).toBe(false);
  });

  it("re-throws redirects (e.g. logout)", async () => {
    await expect(
      succeeded(async () => {
        throw new Error("NEXT_REDIRECT;/admin/login");
      }),
    ).rejects.toThrow("NEXT_REDIRECT");
  });
});
