import { describe, expect, it } from "vitest";
import { makeProperty } from "@/test/fixtures";
import {
  canHostEdit,
  checkNewPassword,
  checkPasswordChange,
  checkSignUp,
  countListings,
  HOST_EDITABLE,
  isUsernameConflict,
  normalizeUsername,
  PASSWORD_MAX,
  PASSWORD_MIN,
  USERNAME_MAX,
  USERNAME_PATTERN,
  validUsername,
} from "./host-accounts";
import { PROPERTY_STATUSES } from "./types";

describe("usernames", () => {
  it("are trimmed, lower-cased and have runs of spaces collapsed, so Ahmed and ahmed are one account", () => {
    expect(normalizeUsername("  Ahmed.Broker ")).toBe("ahmed.broker");
    expect(normalizeUsername("Hamed   Ahmed")).toBe(normalizeUsername("hamed ahmed"));
    expect(normalizeUsername("Hamed \t Ahmed")).toBe("hamed ahmed");
  });

  it("accept letters, digits, spaces and keyboard symbols", () => {
    const names = ["abc", "ahmed.k", "skyline_broker-1", "a1b", "Hamed ahmed", "hamed ahmed", "hamed@ahmed", "hamed.ahmed123", "AHMEDHAMED#@!", ".ahmed", "ahmed-", "x".repeat(USERNAME_MAX)];
    for (const ok of names) expect(validUsername(normalizeUsername(ok)), ok).toBe(true);
  });

  it("reject non-English characters and bad lengths", () => {
    for (const bad of ["ab", "a  ", "x".repeat(USERNAME_MAX + 1), "أحمد", "ahmed\u00e9", "ahmed😀", ""]) {
      expect(validUsername(normalizeUsername(bad)), bad).toBe(false);
    }
  });

  it("has a form pattern the browser can compile (pattern attributes use the v flag)", () => {
    const re = new RegExp(`^(?:${USERNAME_PATTERN})$`, "v");
    expect(re.test("Hamed ahmed#@!")).toBe(true);
    expect(re.test(" hamed ")).toBe(true);
    expect(re.test("أحمد")).toBe(false);
  });
});

describe("checkSignUp", () => {
  const ok = { username: "ahmed", password: "secret-pass", confirm: "secret-pass" };

  it("passes a valid form", () => {
    expect(checkSignUp(ok)).toBeNull();
  });

  it("reports the first problem", () => {
    expect(checkSignUp({ ...ok, username: "a" })).toBe("usernameInvalid");
    expect(checkSignUp({ ...ok, password: "x".repeat(PASSWORD_MIN - 1), confirm: "x".repeat(PASSWORD_MIN - 1) })).toBe("passwordShort");
    expect(checkSignUp({ ...ok, password: "x".repeat(PASSWORD_MAX + 1), confirm: "x".repeat(PASSWORD_MAX + 1) })).toBe("passwordLong");
    expect(checkSignUp({ ...ok, confirm: "secret-pasS" })).toBe("passwordMismatch");
  });

  it("takes passwords exactly as typed (spaces count)", () => {
    expect(checkSignUp({ ...ok, password: " secret-pass", confirm: "secret-pass" })).toBe("passwordMismatch");
    expect(checkSignUp({ ...ok, password: "        ", confirm: "        " })).toBeNull();
  });
});

describe("checkNewPassword", () => {
  it("allows PASSWORD_MIN to PASSWORD_MAX characters, typed the same twice", () => {
    for (const n of [PASSWORD_MIN, PASSWORD_MAX]) expect(checkNewPassword("x".repeat(n), "x".repeat(n)), String(n)).toBeNull();
    expect(checkNewPassword("x".repeat(PASSWORD_MIN - 1), "x".repeat(PASSWORD_MIN - 1))).toBe("passwordShort");
    expect(checkNewPassword("x".repeat(PASSWORD_MAX + 1), "x".repeat(PASSWORD_MAX + 1))).toBe("passwordLong");
    expect(checkNewPassword("secret-pass", "secret-pasS")).toBe("passwordMismatch");
  });
});

describe("checkPasswordChange", () => {
  const ok = { current: "old-secret", password: "new-secret", confirm: "new-secret" };

  it("passes a valid change", () => {
    expect(checkPasswordChange(ok)).toBeNull();
  });

  it("checks the new password like sign-up does", () => {
    expect(checkPasswordChange({ ...ok, password: "short", confirm: "short" })).toBe("passwordShort");
    expect(checkPasswordChange({ ...ok, password: "x".repeat(PASSWORD_MAX + 1), confirm: "x".repeat(PASSWORD_MAX + 1) })).toBe("passwordLong");
    expect(checkPasswordChange({ ...ok, confirm: "new-secreT" })).toBe("passwordMismatch");
  });

  it("refuses the current password as the new one, however its characters are composed", () => {
    expect(checkPasswordChange({ current: "new-secret", password: "new-secret", confirm: "new-secret" })).toBe("passwordUnchanged");
    // é as one character, then as e + combining accent.
    expect(checkPasswordChange({ current: "café-pass", password: "café-pass", confirm: "café-pass" })).toBe("passwordUnchanged");
    expect(checkPasswordChange({ current: "New-secret", password: "new-secret", confirm: "new-secret" })).toBeNull();
  });

  it("doesn't check the current password's length (a wrong one is the server's answer)", () => {
    expect(checkPasswordChange({ ...ok, current: "" })).toBeNull();
  });
});

describe("canHostEdit", () => {
  it("allows pending, needs-changes and published sale listings", () => {
    for (const status of PROPERTY_STATUSES) {
      expect(canHostEdit(makeProperty({ status })), status).toBe(HOST_EDITABLE.includes(status));
    }
    expect(HOST_EDITABLE).toEqual(["pending", "needs_changes", "published"]);
  });

  it("never allows rentals, which only the admin manages", () => {
    expect(canHostEdit(makeProperty({ status: "pending", purpose: "rent" }))).toBe(false);
  });
});

describe("countListings", () => {
  it("counts all, Primary and Resale listings", () => {
    const listings = [makeProperty({ listingType: "primary" }), makeProperty({ listingType: "resale" }), makeProperty({ listingType: "resale" })];
    expect(countListings(listings)).toEqual({ total: 3, primary: 1, resale: 2 });
    expect(countListings([])).toEqual({ total: 0, primary: 0, resale: 0 });
  });
});

describe("isUsernameConflict", () => {
  it("matches only the unique username constraint", () => {
    expect(isUsernameConflict({ code: "23505", constraint_name: "hosts_username_key" })).toBe(true);
    expect(isUsernameConflict({ code: "23505", constraint_name: "hosts_pkey" })).toBe(false);
    expect(isUsernameConflict(new Error("db down"))).toBe(false);
    expect(isUsernameConflict(null)).toBe(false);
  });
});
