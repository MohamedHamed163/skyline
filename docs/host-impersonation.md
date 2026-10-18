# Admin impersonation (enter a host's account)

When a host (broker or owner) is stuck — a listing that won't upload, an edit they can't make — the
admin can **enter that host's account** and act as them to view, fix or edit their listings, without
ever knowing the host's password. The admin's own session authorizes it, a banner shows the whole
time, and every entry is written to an audit log.

This is deliberately *not* a password feature: it exposes nothing. Passwords are stored only as
scrypt hashes ([host-accounts.md](host-accounts.md)) and are never shown to anyone, including the
admin. For a host who forgot their password, use the temporary-password reset instead.

## Admin behaviour

- On a property's admin page (`/admin/properties/[id]`), the owning host's panel (next to **Set a
  temporary password**) has **Enter account**.
- Pressing it asks to confirm ("Enter {username}'s account? You'll act as them until you leave, and
  this is recorded."), then opens **My listings** (`/account`) signed in as that host.
- A gold banner runs across the top of every public/account page: *"You're in {username}'s account
  as an admin. Changes you make here are theirs."* with **Leave account**.
- While impersonating, the browser holds **both** cookies: the admin session (`skyline_admin`) and
  the host session (`skyline_host`). So the admin can still reach `/admin`, and anything the host can
  do at `/account` — edit a listing, change contact details, submit a new one — the admin can do as
  the host, with the host's own rules applied.
- **Leave account** drops only the host session and returns to `/admin`; the admin stays signed in.

## What it is not

- No password is read, shown, set or required.
- It doesn't sign the host out: entering reuses the host's current `sessionVersion`, so the host's
  own sessions keep working, and if the host (or the admin via reset) changes the password, the
  impersonation session ends like any other.
- There is no "enter any account" global list — entry is always from a specific host's property
  page, so it's tied to a concrete support context.

## Audit log

Every entry inserts a row into `impersonation_log` (`host_id`, `created_at`). Because Skyline has a
**single shared admin login** (`ADMIN_PASSWORD`, no per-person admin identity — see
[host-accounts.md](host-accounts.md) and `src/lib/auth.ts`), the log records *which account was
entered and when*, not *which staff member* did it. If several people share the admin login and you
need per-person attribution, that requires per-admin identities first.

## Data model

`src/lib/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS impersonation_log (
  id         text PRIMARY KEY,
  host_id    text NOT NULL REFERENCES hosts (id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS impersonation_log_host_idx ON impersonation_log (host_id, created_at DESC);
```

Idempotent, re-run by `npm run db:setup`. It references `hosts`, so it must be created after that
table (it is, in the same file). No deploy-order constraint beyond that.

## Code map

- `src/lib/actions.ts` — `impersonateHost(hostId)` (admin-only via `requireAdmin`; loads the host,
  logs the entry, starts the host session with the host's `sessionVersion`, redirects to `/account`)
  and `stopImpersonating()` (ends the host session, redirects to `/admin`).
- `src/lib/store.ts` — `logImpersonation(hostId)` and `getImpersonations(hostId, limit)`.
- `src/lib/host-auth.ts` — `startHostSession` / `endHostSession` (reused unchanged; the host cookie
  is separate from the admin cookie, which is what lets both be held at once).
- `src/components/host-impersonate.tsx` — the **Enter account** button (confirm + the action).
- `src/components/impersonation-banner.tsx` — the banner, shown when `isAdmin()` **and**
  `currentHost()` are both set; rendered in `src/app/(site)/layout.tsx`.

## Tests

- `src/lib/actions.test.ts` → "admin: impersonate a host": enters with the host's session version and
  logs it; is admin-only; doesn't start a session for a missing account; **Leave account** ends the
  host session and returns to admin.
