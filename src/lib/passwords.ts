import { createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";

// Password hashing and signed host-session tokens (docs/host-accounts.md). Server code only, but kept
// free of cookies and the database so it can be tested directly. host-auth.ts wires it to the cookie.

const KEY_LENGTH = 64;

const derive = (password: string, salt: Buffer, length: number) =>
  new Promise<Buffer>((resolve, reject) =>
    // NFKC: the same password typed on another device (accents composed differently, full-width
    // letters) still matches.
    scrypt(password.normalize("NFKC"), salt, length, (err, key) => (err ? reject(err) : resolve(key))),
  );

/** "scrypt$<salt>$<hash>" (hex). The prefix leaves room to change the algorithm later. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${(await derive(password, salt, KEY_LENGTH)).toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  if (expected.length === 0) return false;
  return timingSafeEqual(await derive(password, Buffer.from(salt, "hex"), expected.length), expected);
}

/**
 * A valid hash of a password nobody has. Checked when a username doesn't exist, so a wrong username
 * takes as long as a wrong password and the timing doesn't reveal which usernames are taken.
 */
export const DUMMY_HASH = `scrypt$${"0".repeat(32)}$${"0".repeat(KEY_LENGTH * 2)}`;

// Lower-case letters and digits that can't be mistaken for one another when read out over the phone
// or typed on one: no 0/o or 1/l/i.
const TEMPORARY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/**
 * A password the admin gives a host who forgot theirs: three groups of four, e.g. "k7mp-x3qa-9fzt"
 * (about 59 bits). randomInt picks each character without bias.
 */
export function generateTemporaryPassword() {
  const group = () => Array.from({ length: 4 }, () => TEMPORARY_ALPHABET[randomInt(TEMPORARY_ALPHABET.length)]).join("");
  return [group(), group(), group()].join("-");
}

// "host:" keeps these signatures apart from the admin cookie's, which uses the same secret.
const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(`host:${payload}`).digest("hex");

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** A signed-in session: the account and its session_version when the session started. */
export type HostSession = { hostId: string; version: number };

/** The session cookie value: "<hostId>.<session version>.<expires ms>.<signature>". */
export function signSession({ hostId, version }: HostSession, expires: number, secret: string) {
  const payload = `${hostId}.${version}.${expires}`;
  return `${payload}.${sign(payload, secret)}`;
}

/**
 * The session in a cookie value, or null when it is missing, forged or expired. Whether its version
 * is still the account's (no password change since) is checked against the database by currentHost.
 */
export function readSession(value: string | undefined, secret: string, now: number): HostSession | null {
  if (!value || !secret) return null;
  const [hostId, version, expires, signature, ...rest] = value.split(".");
  if (!hostId || !version || !expires || !signature || rest.length) return null;
  if (!safeEqual(signature, sign(`${hostId}.${version}.${expires}`, secret))) return null;
  return /^\d+$/.test(version) && Number(expires) > now ? { hostId, version: Number(version) } : null;
}
