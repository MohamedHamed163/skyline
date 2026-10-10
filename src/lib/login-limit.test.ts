import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "./i18n/en";
import { LIMITS, limiter } from "./rate-limit";

const auth = vi.hoisted(() => ({ checkPassword: vi.fn(), startSession: vi.fn(), endSession: vi.fn(), isAdmin: vi.fn() }));
const requestHeaders = vi.hoisted(() => ({ value: new Headers() }));

vi.mock("./auth", () => auth);
vi.mock("./store", () => ({}));
vi.mock("./photos", () => ({}));
vi.mock("./i18n", async () => ({ ...(await import("./i18n/shared")), getDict: async () => en, isLocale: () => true, LOCALE_COOKIE: "lang" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: async () => requestHeaders.value }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const { adminLogin } = await import("./actions");

const form = (password: string) => {
  const fd = new FormData();
  fd.set("password", password);
  return fd;
};

describe("adminLogin throttling", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_PASSWORD", "secret");
    requestHeaders.value = new Headers({ "x-forwarded-for": "203.0.113.7" });
    limiter.reset("login:203.0.113.7");
    auth.checkPassword.mockImplementation((p: string) => p === "secret");
    auth.checkPassword.mockClear();
    auth.startSession.mockClear();
  });

  it("blocks an IP after too many attempts, even with the right password", async () => {
    for (let i = 0; i < LIMITS.login.max; i++) {
      expect(await adminLogin(null, form("guess"))).toEqual({ ok: false, message: en.msg.wrongPassword });
    }
    const res = await adminLogin(null, form("secret"));
    expect(res).toMatchObject({ ok: false, message: expect.stringContaining("Too many sign-in attempts") });
    expect(auth.checkPassword).not.toHaveBeenCalledWith("secret");
    expect(auth.startSession).not.toHaveBeenCalled();
  });

  it("does not block other IPs", async () => {
    for (let i = 0; i <= LIMITS.login.max; i++) await adminLogin(null, form("guess"));
    requestHeaders.value = new Headers({ "x-forwarded-for": "198.51.100.1" });
    await adminLogin(null, form("secret"));
    expect(auth.startSession).toHaveBeenCalled();
    limiter.reset("login:198.51.100.1");
  });

  it("clears the counter after a successful login", async () => {
    for (let i = 0; i < LIMITS.login.max - 1; i++) await adminLogin(null, form("guess"));
    await adminLogin(null, form("secret"));
    expect(await adminLogin(null, form("guess"))).toEqual({ ok: false, message: en.msg.wrongPassword });
  });
});
