import type { Property, PropertyStatus } from "./types";

// Host accounts (docs/host-accounts.md): brokers and owners sign up with a username and password the
// first time they list a property, then see and edit their listings at /account. Pure rules, safe to
// use in the browser; hashing and the session cookie are in passwords.ts and host-auth.ts.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const PASSWORD_MIN = 8;
/** Long enough for any passphrase, short enough that hashing a huge input can't tie up the server. */
export const PASSWORD_MAX = 128;

/**
 * English letters, digits, spaces and keyboard symbols (printable ASCII, e.g. `Hamed ahmed`,
 * `hamed@ahmed`, `AHMED#@!`). Also the form field's `pattern` (which the browser anchors at both
 * ends), so spaces before or after are allowed there; they are trimmed before saving.
 */
export const USERNAME_PATTERN = "[\\x20-\\x7E]*";

const USERNAME_RE = new RegExp(`^(?:${USERNAME_PATTERN})$`);

/**
 * Usernames are case-insensitive and ignore extra spaces: "Hamed  Ahmed " and "hamed ahmed" are the
 * same account. Trimmed, runs of spaces collapsed to one, lower-cased.
 */
export const normalizeUsername = (raw: string) => raw.trim().replace(/\s+/g, " ").toLowerCase();

/** Whether a normalized username can be used. */
export const validUsername = (username: string) =>
  username.length >= USERNAME_MIN && username.length <= USERNAME_MAX && USERNAME_RE.test(username);

export type NewPasswordError = "passwordShort" | "passwordLong" | "passwordMismatch";

/** What's wrong with a new password typed twice, or null. Passwords are taken as typed. */
export function checkNewPassword(password: string, confirm: string): NewPasswordError | null {
  if (password.length < PASSWORD_MIN) return "passwordShort";
  if (password.length > PASSWORD_MAX) return "passwordLong";
  if (password !== confirm) return "passwordMismatch";
  return null;
}

export type SignUpError = "usernameInvalid" | NewPasswordError;

/** What's wrong with a sign-up form, or null when it can be saved. */
export function checkSignUp({ username, password, confirm }: { username: string; password: string; confirm: string }): SignUpError | null {
  if (!validUsername(username)) return "usernameInvalid";
  return checkNewPassword(password, confirm);
}

export type PasswordChangeError = NewPasswordError | "passwordUnchanged";

/**
 * What's wrong with a change-password form before the current password is checked, or null. The new
 * password must differ from the current one (compared the way verifyPassword does, NFKC-normalized),
 * so a temporary password from Skyline is really replaced.
 */
export function checkPasswordChange({ current, password, confirm }: { current: string; password: string; confirm: string }): PasswordChangeError | null {
  return checkNewPassword(password, confirm) ?? (password.normalize("NFKC") === current.normalize("NFKC") ? "passwordUnchanged" : null);
}

/**
 * Statuses a host can still edit. Pending and needs-changes listings are edited in place and go
 * (back) to review; on a published one the edit waits for the admin while the listing stays live
 * (docs/host-edit-approval.md). Reserved, sold, archived and rejected listings are locked: the host
 * contacts Skyline to change them.
 */
export const HOST_EDITABLE: readonly PropertyStatus[] = ["pending", "needs_changes", "published"];

/** Whether the host may edit this listing now. Sale listings only: rentals are the admin's. */
export const canHostEdit = (p: Pick<Property, "status" | "purpose">) => p.purpose === "sale" && HOST_EDITABLE.includes(p.status);

/**
 * Whether a database error is the unique `hosts.username` constraint, i.e. someone took the username
 * between the check and the insert. postgres.js reports it as SQLSTATE 23505 with the constraint's name.
 */
export function isUsernameConflict(err: unknown) {
  const e = err as { code?: unknown; constraint_name?: unknown } | null;
  return e?.code === "23505" && e.constraint_name === "hosts_username_key";
}

/** How many listings a host has, in total and by listing type, for the /account summary. */
export function countListings(properties: Pick<Property, "listingType">[]) {
  const primary = properties.filter((p) => p.listingType === "primary").length;
  return { total: properties.length, primary, resale: properties.length - primary };
}
