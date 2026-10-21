# Forgot password and the admin's Accounts page

Broker and owner accounts have only a username and a password: no email or phone to send a reset
link to. A host who forgets their password presses **Forgot your password?** and leaves their
username and a phone number. The request appears on the admin's **Accounts** page. The admin calls
them, checks it's really them, and sets a new password (generated, or one the admin types), then
tells them what it is. The host signs in with it and is asked to choose their own
([host-accounts.md](host-accounts.md)).

## User behaviour (sign-in form on `/submit` and `/account`)

- Under **Sign in** there is **Forgot your password?**. It replaces the form with **Forgot your
  password?** and two fields:
  - **Username**: carried over from the sign-in form if one was typed. Letter case and extra spaces
    don't matter, as at sign-in.
  - **Phone or WhatsApp number**: 8–20 digits, spaces, `+`, `-` or brackets (the listing form's
    phone rule).
- **Send request** shows "Request sent. Skyline will contact you on {phone} with a temporary
  password." The answer is the same whether or not the username exists, so the form can't be used
  to find out which usernames are taken.
- Errors keep what was typed: "Type the username you signed up with.", "Type a phone number Skyline
  can reach you on…". A connection can send 3 requests an hour, counted after the form checks
  ("Too many requests from this connection. Try again in N min, or contact Skyline.").
- **Back to sign in** returns to the sign-in form.

## Admin behaviour

### Accounts (`/admin/accounts`)

- **Accounts** is in the admin menu after **Brokers / Owners**, with a gold counter of open password
  requests.
- **Password requests** (shown only when there are some), newest first. Each has:
  - the username as typed and when it was sent;
  - the phone to contact, with **Call** and **WhatsApp** (the WhatsApp message opens with "Hello,
    this is Skyline about your request to reset the password of your account {username}.");
  - an identity check against the phone numbers on the account's listings: green "Same phone as on
    their listings", red "Not a phone from their listings. Check it's really them.", or "No listings
    yet, so no phone to check against.";
  - the password controls (below), or "No account has this username…" when nobody has that
    username. Then the admin asks the host for the right username and finds the account in the
    list;
  - **Dismiss**, after a confirmation, closes the request without changing anything (for example
    when the caller isn't the owner).
- Setting a password for an account closes all of its open requests. The request stays on screen,
  showing the new password, until the page is reloaded.
- The **account list**, newest first: username, a "Temporary password" badge while the host still
  uses one from Skyline, the join date, the number of listings, the phone numbers on those listings,
  **Enter account** ([host-impersonation.md](host-impersonation.md)) and the password controls.
  Search by username, or by 3+ digits of a listing phone. Accounts with no listings are listed too
  (previously they could only be reached from one of their property pages).

### Password controls (Accounts page and the property page's status card)

- **Set a temporary password** generates one (e.g. `k7mp-x3qa-9fzt`), as before.
- **Or type a password** opens a plain-text field ("New password for {username}") and **Set this
  password**: 8–128 characters, taken exactly as typed. Use it when the host wants a password that's
  easy to say over the phone.
- Both ask for confirmation first, show the password once with **Copy**, flag it as temporary (so
  `/account` asks the host to choose their own), and sign the host out everywhere.

## Data model

```sql
CREATE TABLE password_requests (
  id          text PRIMARY KEY,
  username    text NOT NULL,              -- normalized like a username
  host_id     text REFERENCES hosts (id), -- NULL: no account has that username
  phone       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz                 -- set on reset or dismiss; NULL while open
);
CREATE INDEX password_requests_open_idx ON password_requests (created_at DESC) WHERE resolved_at IS NULL;
```

Types: `PasswordRequest` and `HostSummary` (a `Host` with `listings` and `phones`) in
`src/lib/types.ts`.

**Deploy order:** run `npm run db:setup` before deploying. Until the table exists, the admin menu
counter reads 0, but the Accounts page and sending a request fail. No new environment variables.

## Security

- Nothing is reset automatically. The admin decides, after speaking to the host. The listing phone
  check is a hint for the admin, not proof.
- The request never reveals whether a username exists, and it's rate limited per IP
  (`LIMITS.passwordRequest`, 3 per hour, see [rate-limiting.md](rate-limiting.md)).
- `resetHostPassword(hostId, chosen?)` and `dismissPasswordRequest(id)` go through `requireAdmin`.
  A typed password is hashed like any other and never stored or logged in plain text.
  `getHostSummaries` never reads password hashes.

## Code map

| File | What it does |
| --- | --- |
| `src/lib/password-help.ts` | Pure rules: `checkPasswordRequest`, `checkAdminPassword`, `phoneMatches`, `filterAccounts`. |
| `src/lib/actions.ts` | `requestPasswordReset` (public), `resetHostPassword(hostId, chosen?)`, `dismissPasswordRequest` (admin). |
| `src/lib/store.ts` | `getHostSummaries`, `createPasswordRequest`, `getPasswordRequests`, `countPasswordRequests`, `resolvePasswordRequest`, `resolveHostPasswordRequests`. |
| `src/lib/rate-limit.ts` | `LIMITS.passwordRequest`. |
| `src/components/host-auth-form.tsx` | **Forgot your password?** link and form (`ForgotFields`). |
| `src/components/host-password-reset.tsx` | Generated or typed password, shown once. `bare` drops the hint and divider for the Accounts page. |
| `src/components/password-request-dismiss.tsx` | **Dismiss** on a request. |
| `src/app/admin/(panel)/accounts/page.tsx` | The Accounts page. |
| `src/app/admin/(panel)/layout.tsx` | Menu item and open-request counter. |

## Tests

- `src/lib/password-help.test.ts`: request checks (username length after normalizing, phone format),
  the typed-password length rules, phone matching across formats (`0…`, `+20…`, `00 20…`), and
  account search by username or phone.
- `src/lib/actions.test.ts` ("host accounts: forgot password request", "admin: password typed by the
  admin", "admin: dismiss a password request"): requests saved with or without an account and the
  same answer either way, form checks before the rate limit, 3 per hour, storage failures; typed
  passwords kept exactly, hashed and flagged temporary, length errors, requests closed after a reset
  (and the password still returned if closing fails), admin-only actions.
- `src/lib/store.test.ts` ("password help"): the SQL for the account list (no password hashes),
  saving, listing, counting and closing requests.
