# Host accounts (brokers and owners)

Brokers and owners ("hosts") list properties through an account. The first time they press **List
a property**, they create one with a username and password, typing the password twice. After that
they sign in once and land on **My listings** (`/account`). That page has **List a property** for
the next one, how many listings they have (all, Primary and Resale), and every listing they sent,
each with **View** and **Edit**, then **Change password**. A host who forgets their password asks
Skyline, and the admin gives them a temporary one.

## User behaviour

### First time: create an account (`/submit`)

- **List a property** in the navbar opens `/submit`. Signed out, the form is replaced by **Create
  your Skyline account**, with three fields:
  - **Username**: 3–30 English letters, numbers, spaces or keyboard symbols (printable ASCII),
    e.g. `Hamed ahmed`, `hamed@ahmed`, `hamed.ahmed123`, `AHMEDHAMED#@!`. Usernames ignore letter
    case and extra spaces: `Hamed  Ahmed ` and `hamed ahmed` are the same account. They are
    stored trimmed, with runs of spaces collapsed to one, in lower case. Arabic letters and emoji
    are not accepted.
  - **Password**: at least 8 characters (at most 128), taken exactly as typed.
  - **Re-enter password**: it must match. A mismatch is shown under the field as you type, and
    the browser won't submit until it matches.
- **Create account** signs the host in and opens the property form straight away (same form as
  before: Primary or Resale, details, photos, and documents for Primary).
- Errors keep everything that was typed: "The username ahmed is taken. Please choose another one.",
  "Your password must have at least 8 characters.", "The two passwords don't match…".
- After **Submit for review**, the confirmation has **Go to my listings** and **Submit another
  property**.

### Next times: sign in, then My listings (`/account`)

- Once a browser has created an account or signed in, `/submit` opens on **Sign in to your
  account** instead (a `skyline_host_known` cookie remembers this, and survives sign-out). Each
  form links to the other ("Already have an account? Sign in" / "New to Skyline? Create an
  account").
- **Sign in** (username + password, once) opens **My listings** at `/account`:
  - **List a property** (to `/submit`) and **Sign out** at the top.
  - Three counters: **All listings**, **Primary**, **Resale**.
  - One row per listing, newest first: photo, status, Primary/Resale badge, the property code (or
    "Code given on approval"), place and price, a status hint (e.g. "Skyline is reviewing this
    listing.", "Live on the website.") and the date it was sent, with **View** and **Edit**.
  - No listings yet: "You haven't listed a property yet…" and a **List a property** button.
- A wrong username and a wrong password get the same answer: "Wrong username or password." After 5
  wrong attempts from one connection, sign-in waits 15 minutes.
- Sessions last 30 days. While signed in, the navbar shows **My account** next to **List a property**
  (just the icon from 1024 to 1279px wide, where the menu links share the row; on phones it is first
  in the scrolling menu row instead, see [site-header.md](site-header.md)), and
  `/submit` shows the form directly, with "Signed in as …", **My listings** and **Sign out** above it.
- Signed out, `/account` shows the sign-in form. The listing pages send you to `/account`.

### Change password (`/account`)

- **Change password** is the last card on `/account`: **Current password**, **New password** (the
  same rules as sign-up: 8 to 128 characters, taken exactly as typed) and **Re-enter new password**
  (a mismatch shows as you type, as on sign-up). The card says that changing it signs you out on
  your other phones and computers and keeps you signed in here.
- On success: "Password changed. You're signed out on your other devices." The fields are cleared.
  Every other browser signed in to the account is signed out (its next page that loads the account
  shows the sign-in form; the navbar may show **My account** until then, as it only checks the
  cookie's signature).
- Errors keep what was typed: "Your current password is wrong.", "Choose a new password that's
  different from your current one.", plus the sign-up messages for a short, long or mismatched new
  password. The new password is checked before the current one, so typing mistakes there don't count
  as wrong passwords.
- After 5 wrong current passwords on one account (from any connection), changing waits 15 minutes:
  "Too many wrong passwords. Try again in 15 min." A correct one clears the count.

### Forgot password: a temporary password from Skyline

- There is no self-service reset (accounts have no email or phone to send a link to). The host asks
  Skyline, and the admin sets a temporary password for the account (see Admin behaviour).
- The host signs in with it as usual. `/account` then shows "You signed in with a temporary password
  from Skyline. Please choose your own password." with a **Change password** link to the card. The
  notice goes away once they change it.

### View a listing (`/account/listings/[id]`)

Shows the listing as Skyline has it, in any status: photos, status and code, key facts, price,
descriptions (or "About the project" / "About the developer" for Primary), features and the host's
own contact details (marked private). A published listing has **See it on the website**. An
editable one has **Edit**. Other hosts' listings, and properties the admin added, return 404.

### Edit a listing (`/account/listings/[id]/edit`)

- The same fields as `/submit` (Primary/Resale, details, seller details) and the photos, filled in.
  Documents can't be changed here ("Contact Skyline if they need to change.").
- **Save and send for review** on a listing that isn't live yet (Pending Approval, Needs Changes)
  saves the changes onto it and sets it (back) to **Pending Approval**. On a **published** listing
  the changes are held for the admin's approval and the website keeps showing the listing as it was.
  See [host-edit-approval.md](host-edit-approval.md).
- Hosts can edit listings that are **Pending Approval**, **Needs Changes** or **Published**.
  **Reserved**, **Sold**, **Archived** and **Rejected** listings are view-only ("Contact Skyline to
  change this listing."), and so are rentals.
- The admin's own settings are kept when a host saves: "Show on the home page", purpose (sale/rent)
  and rental prices. The admin's internal notes are never shown to the host. "Needs Changes" tells
  the host that Skyline will contact them.

## Admin behaviour

- Submissions arrive in the dashboard exactly as before. The property page's status card adds
  **Account: username** for listings sent from an account.
- Under it, **Set a temporary password** ("For a host who forgot their password.") asks first
  ("Give ahmed a temporary password? Their current password stops working and they're signed out
  everywhere."), then shows the new password once, with **Copy**: three groups of four lower-case
  letters and digits, e.g. `k7mp-x3qa-9fzt`, without look-alikes (0/o, 1/l/i) so it can be read out
  over the phone. It is never stored in plain text and isn't shown again: pressing the button again
  makes a new one. The host's old password stops working and all their sessions end.
- A host's edit to a pending or needs-changes listing puts it in **Pending Approvals**. An edit to a
  published listing waits under **Edits to approve**, where the admin compares old and new values
  and approves or rejects them ([host-edit-approval.md](host-edit-approval.md)).
- Properties the admin adds, and those sent before accounts existed, have no account and don't
  appear in anyone's `/account`.

## Security

- Passwords are hashed with scrypt and a random salt per account (`scrypt$<salt>$<hash>`). The
  hash never leaves `store.ts`/`actions.ts`. An unknown username is checked against a dummy hash,
  so its timing doesn't reveal which usernames exist.
- The session is an http-only, `SameSite=Lax` cookie (`skyline_host`, `Secure` in production)
  holding `hostId.version.expires.signature`. It is an HMAC-SHA256 signed with the same secret as
  the admin cookie (`SESSION_SECRET`, or `ADMIN_PASSWORD` when that is unset), with a `host:` prefix
  so the two cookies can't stand in for each other. Without either variable, accounts are off
  ("Accounts aren't available right now").
- `version` is the account's `hosts.session_version` when the session started. Every password
  change (the host's or the admin's) adds 1 to it, and `currentHost` treats a cookie with an older
  version as signed out, so one change ends every session at once. The host's own browser gets a
  fresh cookie with the new version and stays signed in. Cookies from before session versions
  (`hostId.expires.signature`) no longer read, so those hosts sign in once more.
- Changing a password needs the current one (`verifyPassword` against the stored hash). The
  admin's reset (`resetHostPassword`) goes through `requireAdmin`, uses `randomInt` for every
  character (about 59 bits), stores only the hash and returns the password to the admin once.
- Every host action checks the session and ownership on the server: `submitProperty` refuses
  without a signed-in host, and `updateHostProperty` only changes the host's own sale listing while
  it is editable. The database update checks the same conditions again, in case the admin changed
  the status meanwhile.
- Rate limits ([rate-limiting.md](rate-limiting.md)): sign-in shares the admin login's allowance of
  5 attempts per 15 minutes per IP but counts separately. Sign-up allows 5 attempts per hour per IP,
  counted after the form checks so typing mistakes don't use it up. Changing a password has the same
  5 per 15 minutes, counted per **account** (`host-password:<hostId>`), so someone holding a stolen
  session can't guess the current password from many connections.

## Data model

```sql
CREATE TABLE hosts (
  id            text PRIMARY KEY,
  username      text NOT NULL UNIQUE,   -- lower case
  password_hash text NOT NULL,          -- scrypt$<salt>$<hash>
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE hosts ADD COLUMN session_version integer NOT NULL DEFAULT 0;      -- +1 on every password change
ALTER TABLE hosts ADD COLUMN password_temporary boolean NOT NULL DEFAULT false; -- set by the admin's reset
ALTER TABLE properties ADD COLUMN host_id text REFERENCES hosts (id);  -- NULL: admin-added / older
CREATE INDEX properties_host_idx ON properties (host_id);
```

`Host` (with `sessionVersion` and `temporaryPassword`) and `Property.hostId` are in
`src/lib/types.ts`. `store.setHostPassword(id, hash, temporary)` replaces the hash, sets
`password_temporary` and adds 1 to `session_version` in one `UPDATE … RETURNING session_version`.

**Deploy order:** run `npm run db:setup` against the database **before** deploying this code. Sign-up
and sign-in need the `hosts` table, and host submissions write `host_id`. `getHost` (every signed-in
page) reads `session_version` and `password_temporary`, so on a database without them signed-in
pages fail: add the columns first. Reading properties is safe either way: a missing `host_id` reads
as "no account", and admin-added properties don't write the column. No new environment variables
are needed.

## Code map

| File | What it does |
| --- | --- |
| `src/lib/host-accounts.ts` | Pure rules: username/password limits and `USERNAME_PATTERN`, `checkNewPassword`, `checkSignUp`, `checkPasswordChange`, `HOST_EDITABLE` / `canHostEdit`, `countListings`, `isUsernameConflict`. Safe in the browser. |
| `src/lib/passwords.ts` | `hashPassword` / `verifyPassword` (scrypt), `DUMMY_HASH`, `generateTemporaryPassword`, `signSession` / `readSession` for the cookie value (host id and session version). |
| `src/lib/host-auth.ts` | The cookie: `startHostSession(hostId, version)`, `endHostSession`, `currentHostId` (signature only, used by the navbar), `currentHost` (also loads the account and checks the session version), `knownHost`, `ownListing`. |
| `src/lib/store.ts` | `createHost`, `getHost`, `getHostLogin`, `setHostPassword`, `getHostProperties`, `updateHostProperty`; `createProperty` takes `hostId`. |
| `src/lib/actions.ts` | `hostSignUp`, `hostSignIn`, `hostSignOut`, `changeHostPassword`, `updateHostProperty`; `submitProperty` requires a host. Admin: `resetHostPassword`. |
| `src/components/host-auth-form.tsx` | The Create account / Sign in form. |
| `src/components/host-password-form.tsx` | The Change password form on `/account`. |
| `src/components/host-password-reset.tsx` | The admin's **Set a temporary password** button and the one-time password. |
| `src/components/account-ui.tsx` | Listing rows, status badge, "Signed in as" bar, sign-out button. |
| `src/components/host-edit-form.tsx` | The edit form (reuses `ListingTypeChoice`, `PropertyFields` and `PhotoPicker`). Held edits and the admin's review: [host-edit-approval.md](host-edit-approval.md). |
| `src/components/status-badge.tsx` | Status colours shared with the admin dashboard. |
| `src/app/(site)/submit/page.tsx` | The gate, or the form for a signed-in host. |
| `src/app/(site)/account/…` | My listings, the listing page and the edit page. |

## Tests

- `src/lib/host-accounts.test.ts`: username rules (and that the form pattern compiles with the
  browser's `v` flag), new-password, sign-up and change-password checks (including "same as the
  current one" across Unicode compositions), which statuses are editable, the counters, the
  conflict check.
- `src/lib/passwords.test.ts`: hashing, salting, Unicode normalization, malformed hashes, session
  tokens that are expired, tampered with (including a moved-on version), signed with another
  secret, admin-shaped or in the older format without a version, and temporary passwords (format,
  randomness, valid and verifiable).
- `src/lib/host-auth.test.ts`: the cookie with a mocked jar, including sign-out keeping the
  "known" cookie, deleted accounts, sessions ended by a password change, no secret, and
  `ownListing` hiding other hosts' listings.
- `src/lib/store.test.ts` ("host accounts"): the SQL for accounts (session version and temporary
  flag, read as 0 / false before the columns exist), `setHostPassword`, the host's listings and the
  edit (admin-only columns kept, status set to pending, ownership and status in the `WHERE`).
- `src/lib/actions.test.ts` ("host accounts: …", "admin: temporary host password"): sign-up (lower
  case, hashing, taken usernames, race, rate limit), sign-in (same message for wrong password and
  unknown user, rate limit and reset, session version), sign-out, password changes (hashing, other
  sessions signed out and this one kept, form checks first, wrong current password, per-account
  rate limit, failures), the admin's temporary password (admin-only, hashed, flagged temporary,
  missing account), submissions filed under the host, and edits refused when signed out, not the
  owner, locked, or changed by the admin meanwhile.
