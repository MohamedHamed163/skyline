import { intlDigits } from "./format";
import { normalizeUsername, PASSWORD_MAX, PASSWORD_MIN, USERNAME_MAX } from "./host-accounts";
import type { HostSummary } from "./types";
import { validPhone } from "./validation";

// Rules for "Forgot your password?" and the admin's password resets (docs/password-help.md). Pure,
// so it is unit-tested without the database.

export type PasswordRequestError = "requestUsername" | "requestPhone";

/** What's wrong with a forgot-password request, or null when it can be sent. */
export function checkPasswordRequest({ username, phone }: { username: string; phone: string }): PasswordRequestError | null {
  const name = normalizeUsername(username);
  if (!name || name.length > USERNAME_MAX) return "requestUsername";
  if (!validPhone(phone.trim())) return "requestPhone";
  return null;
}

export type AdminPasswordError = "passwordShort" | "passwordLong";

/** A password the admin typed for a host: the sign-up length rules, taken exactly as typed. */
export function checkAdminPassword(password: string): AdminPasswordError | null {
  if (password.length < PASSWORD_MIN) return "passwordShort";
  if (password.length > PASSWORD_MAX) return "passwordLong";
  return null;
}

/** Whether a phone number is one of the account's listing phones, however either was written. */
export function phoneMatches(phone: string, phones: string[]) {
  const digits = intlDigits(phone);
  return digits.length > 0 && phones.some((p) => intlDigits(p) === digits);
}

/** Accounts whose username contains `q`, or (3+ digits) one of whose listing phones does. */
export function filterAccounts<T extends Pick<HostSummary, "username" | "phones">>(accounts: T[], q: string) {
  const query = normalizeUsername(q);
  if (!query) return accounts;
  const digits = q.replace(/\D/g, "");
  return accounts.filter(
    (a) => a.username.includes(query) || (digits.length >= 3 && a.phones.some((p) => p.replace(/\D/g, "").includes(digits))),
  );
}
