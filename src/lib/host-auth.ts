import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { readSession, signSession } from "./passwords";
import * as store from "./store";

// Host sessions (docs/host-accounts.md): a signed cookie holding the account id, like the admin's.

const COOKIE = "skyline_host";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
/** Set once a browser has signed up or in, so /submit opens on "Sign in" instead of "Create account". */
const KNOWN_COOKIE = "skyline_host_known";

const secret = () => process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "";

/** Accounts need a signing secret: without one nobody can sign up or in. */
export const hostSessionsEnabled = () => Boolean(secret());

const options = { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" } as const;

/** `version` is the account's session_version: a later password change ends this session. */
export async function startHostSession(hostId: string, version: number) {
  const jar = await cookies();
  jar.set(COOKIE, signSession({ hostId, version }, Date.now() + MAX_AGE * 1000, secret()), { ...options, maxAge: MAX_AGE });
  jar.set(KNOWN_COOKIE, "1", { ...options, maxAge: 60 * 60 * 24 * 365 });
}

export async function endHostSession() {
  (await cookies()).delete(COOKIE);
}

const currentSession = cache(async () => readSession((await cookies()).get(COOKIE)?.value, secret(), Date.now()));

/**
 * The signed-in host's id, checked against the signature only (no database read). A session ended by
 * a password change still has one until a page loads the account with currentHost.
 */
export const currentHostId = cache(async () => (await currentSession())?.hostId ?? null);

/**
 * The signed-in host, or null. Also null when the account no longer exists, or its password changed
 * since this session started (another browser's change, or the admin's reset).
 */
export const currentHost = cache(async () => {
  const session = await currentSession();
  if (!session) return null;
  const host = await store.getHost(session.hostId);
  return host && host.sessionVersion === session.version ? host : null;
});

/** Whether this browser has had an account here before. */
export async function knownHost() {
  return (await cookies()).has(KNOWN_COOKIE);
}

/**
 * One of the signed-in host's own listings, for the /account/listings pages. `property` is undefined
 * when it doesn't exist or belongs to someone else, so other hosts' listings look like missing pages.
 */
export async function ownListing(id: string) {
  const host = await currentHost();
  if (!host) return { host: null, property: undefined };
  const property = await store.getProperty(id);
  return { host, property: property?.hostId === host.id ? property : undefined };
}
