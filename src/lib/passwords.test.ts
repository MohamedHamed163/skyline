import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkNewPassword } from "./host-accounts";
import { DUMMY_HASH, generateTemporaryPassword, hashPassword, readSession, signSession, verifyPassword } from "./passwords";

describe("password hashing", () => {
  it("verifies the right password and rejects others", async () => {
    const hash = await hashPassword("secret-pass");
    expect(hash).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(hash).not.toContain("secret-pass");
    expect(await verifyPassword("secret-pass", hash)).toBe(true);
    expect(await verifyPassword("secret-pasS", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("secret-pass")).not.toBe(await hashPassword("secret-pass"));
  });

  it("matches the same password typed with differently composed characters", async () => {
    const hash = await hashPassword("café-pass"); // é as one character
    expect(await verifyPassword("café-pass", hash)).toBe(true); // e + combining accent
  });

  it("rejects malformed hashes instead of throwing", async () => {
    for (const stored of ["", "plain", "bcrypt$aa$bb", "scrypt$$", "scrypt$00$"]) expect(await verifyPassword("x", stored), stored).toBe(false);
  });

  it("has a dummy hash that no password matches", async () => {
    expect(await verifyPassword("", DUMMY_HASH)).toBe(false);
    expect(await verifyPassword("password", DUMMY_HASH)).toBe(false);
  });
});

describe("host session tokens", () => {
  const SECRET = "test-secret";
  const NOW = 1_800_000_000_000;

  const H1 = { hostId: "h1", version: 3 };

  it("round-trips the host id and session version until it expires", () => {
    const token = signSession(H1, NOW + 1000, SECRET);
    expect(token).toMatch(/^h1\.3\.\d+\.[0-9a-f]{64}$/);
    expect(readSession(token, SECRET, NOW)).toEqual(H1);
    expect(readSession(token, SECRET, NOW + 1000)).toBeNull();
    expect(readSession(signSession({ hostId: "h1", version: 0 }, NOW + 1000, SECRET), SECRET, NOW)).toEqual({ hostId: "h1", version: 0 });
  });

  it("rejects tokens that were changed or signed with another secret", () => {
    const token = signSession(H1, NOW + 1000, SECRET);
    const [, version, expires, signature] = token.split(".");
    expect(readSession(`h2.${version}.${expires}.${signature}`, SECRET, NOW)).toBeNull();
    // An old session can't be moved on to the account's current version.
    expect(readSession(`h1.4.${expires}.${signature}`, SECRET, NOW)).toBeNull();
    expect(readSession(`h1.${version}.${NOW + 999_999}.${signature}`, SECRET, NOW)).toBeNull();
    expect(readSession(token, "other-secret", NOW)).toBeNull();
    expect(readSession(`${token}.extra`, SECRET, NOW)).toBeNull();
  });

  it("rejects a version that isn't a whole number, even when signed", () => {
    for (const version of ["-1", "1.5", "x", "1e3"]) {
      const payload = `h1.${version}.${NOW + 1000}`;
      const signature = createHmac("sha256", SECRET).update(`host:${payload}`).digest("hex");
      expect(readSession(`${payload}.${signature}`, SECRET, NOW), version).toBeNull();
    }
  });

  it("signs out cookies from before session versions (hostId.expires.signature)", () => {
    const payload = `h1.${NOW + 1000}`;
    const signature = createHmac("sha256", SECRET).update(`host:${payload}`).digest("hex");
    expect(readSession(`${payload}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it("rejects missing tokens and works only with a secret", () => {
    expect(readSession(undefined, SECRET, NOW)).toBeNull();
    expect(readSession("", SECRET, NOW)).toBeNull();
    expect(readSession(signSession(H1, NOW + 1000, ""), "", NOW)).toBeNull();
  });

  it("doesn't accept an admin cookie (expires.signature) as a host session", () => {
    expect(readSession(`${NOW + 1000}.abc`, SECRET, NOW)).toBeNull();
  });
});

describe("temporary passwords", () => {
  it("are three groups of four easy-to-read characters", () => {
    for (let i = 0; i < 50; i++) expect(generateTemporaryPassword()).toMatch(/^[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}$/);
  });

  it("are random", () => {
    expect(new Set(Array.from({ length: 50 }, generateTemporaryPassword)).size).toBe(50);
  });

  it("are valid new passwords that verify once hashed", async () => {
    const password = generateTemporaryPassword();
    expect(checkNewPassword(password, password)).toBeNull();
    expect(await verifyPassword(password, await hashPassword(password))).toBe(true);
  });
});
