import { describe, expect, it } from "vitest";
import { makeHost } from "@/test/fixtures";
import { checkAdminPassword, checkPasswordRequest, filterAccounts, phoneMatches } from "./password-help";

describe("checkPasswordRequest", () => {
  it("accepts a username and a phone number", () => {
    expect(checkPasswordRequest({ username: "Hamed Ahmed", phone: "01012345678" })).toBeNull();
    expect(checkPasswordRequest({ username: "ahmed", phone: "+20 101 234 5678" })).toBeNull();
  });

  it("needs a username of at most the sign-up length", () => {
    expect(checkPasswordRequest({ username: "   ", phone: "01012345678" })).toBe("requestUsername");
    expect(checkPasswordRequest({ username: "a".repeat(31), phone: "01012345678" })).toBe("requestUsername");
    // Extra spaces don't count, as at sign-up.
    expect(checkPasswordRequest({ username: `  ${"a".repeat(30)}  `, phone: "01012345678" })).toBeNull();
  });

  it("needs a phone number", () => {
    expect(checkPasswordRequest({ username: "ahmed", phone: "" })).toBe("requestPhone");
    expect(checkPasswordRequest({ username: "ahmed", phone: "1234" })).toBe("requestPhone");
    expect(checkPasswordRequest({ username: "ahmed", phone: "call me" })).toBe("requestPhone");
  });
});

describe("checkAdminPassword", () => {
  it("uses the sign-up length rules and takes the password as typed", () => {
    expect(checkAdminPassword("1234567")).toBe("passwordShort");
    expect(checkAdminPassword("12345678")).toBeNull();
    expect(checkAdminPassword("  spaces  ")).toBeNull();
    expect(checkAdminPassword("x".repeat(128))).toBeNull();
    expect(checkAdminPassword("x".repeat(129))).toBe("passwordLong");
  });
});

describe("phoneMatches", () => {
  it("matches the same number written differently", () => {
    expect(phoneMatches("01012345678", ["+20 101 234 5678"])).toBe(true);
    expect(phoneMatches("0020 1012345678", ["01099999999", "010-1234-5678"])).toBe(true);
  });

  it("doesn't match another number, an empty one or an account without listings", () => {
    expect(phoneMatches("01012345678", ["01099999999"])).toBe(false);
    expect(phoneMatches("", [""])).toBe(false);
    expect(phoneMatches("01012345678", [])).toBe(false);
  });
});

describe("filterAccounts", () => {
  const accounts = [
    { ...makeHost({ id: "h1", username: "hamed ahmed" }), listings: 2, phones: ["01012345678"] },
    { ...makeHost({ id: "h2", username: "sara@home" }), listings: 0, phones: [] },
  ];

  it("shows every account without a search", () => {
    expect(filterAccounts(accounts, "  ")).toHaveLength(2);
  });

  it("finds by username, ignoring case and extra spaces", () => {
    expect(filterAccounts(accounts, "  HAMED   Ahmed ").map((a) => a.id)).toEqual(["h1"]);
    expect(filterAccounts(accounts, "@home").map((a) => a.id)).toEqual(["h2"]);
  });

  it("finds by a listing phone from 3 digits on", () => {
    expect(filterAccounts(accounts, "1234 5678").map((a) => a.id)).toEqual(["h1"]);
    expect(filterAccounts(accounts, "99")).toEqual([]);
  });
});
