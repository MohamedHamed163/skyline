# Host edits need the admin's approval

A broker or owner (a "host", see [host-accounts.md](host-accounts.md)) can edit their listings from
`/account` at any time. Once a listing is **published**, the host's changes are held separately. The
website keeps showing the listing as it was. The admin sees the old and new values side by side,
photos included, and either **approves** them (they go live) or **rejects** them (they are
discarded). Listings that aren't live yet are edited directly.

## Host behaviour (`/account`)

| Listing status | What **Save and send for review** does |
| --- | --- |
| Pending Approval, Needs Changes | Saves straight onto the listing, which goes (back) to **Pending Approval**. Nothing of it is live yet. |
| Published | Holds the changes for Skyline. The listing stays published and unchanged on the website. "Changes sent to Skyline. Your listing stays on the website as it is until they're approved." |
| Reserved, Sold, Archived, Rejected | Can't be edited ("Contact Skyline to change this listing."). |

- The edit form has the `/submit` fields (Primary/Resale, details, seller details) and the **photos**:
  remove any, add new ones (up to 8, same size rules as `/submit`, see
  [photo-uploads.md](photo-uploads.md)). The first photo is the main image. Documents can't be
  changed here.
- While changes wait, the listing row and page say "Changes waiting for approval" / "Your changes
  are waiting for Skyline's approval. The website shows the listing as it was until then." The
  button reads **Edit your changes**, and the form opens on the waiting values, so the host can keep
  refining them. Each save replaces the waiting edit. There is only ever one per listing.
- After the admin decides, the row and page show "Skyline approved your last changes." or "Skyline
  didn't accept your last changes." with the admin's note, if any ("Skyline's note: …"). The message
  stays until the host's next edit.
- If the admin changes the listing's status while the host has the form open (e.g. publishes a
  pending listing), saving says "This listing changed while you were editing. Reload the page and
  try again." Nothing is saved.

## Admin behaviour

- The sidebar has **Edits to approve** with a count (`/admin/properties?edits=waiting`). In the
  properties list, a listing with a waiting edit has an **Edit waiting** badge under its title.
- The property page (`/admin/properties/[id]`) shows **Changes from the host** above the photos:
  who sent them and when, then a table with one row per changed field (**Field | Current |
  Proposed**). Seller details are compared part by part (type, name, phone, WhatsApp, company), and
  features ignore the order they were ticked in. For photos, both sets are shown as thumbnails.
  Photos the edit removes are outlined in red ("Removed"), new ones in green ("New"), and a change
  of order (a new main image) shows as a change too.
- **Approve changes** (with a confirmation) copies the values onto the listing, updates "Last
  updated" and refreshes the public pages. **Reject changes** (with an optional note for the host)
  discards them. The listing stays as it was. The status card then shows "Last host edit
  approved/rejected on …" with the note.
- The admin approves exactly the version they were shown. If the host saved a newer one in the
  meantime, it is not applied: the page reloads with the newer version to review.
- The admin's own edit form and status buttons work as before and don't touch a waiting edit. The
  comparison is always against the live values.

## Data model

```sql
ALTER TABLE properties ADD COLUMN pending_edit jsonb;  -- { "values": {…}, "submittedAt": "…" } or NULL
ALTER TABLE properties ADD COLUMN edit_outcome jsonb;  -- { "result": "approved" | "rejected", "note", "at" } or NULL
```

`values` holds the host-editable fields (`HOST_EDIT_KEYS`: title, listingType, type, location,
compound, area, bedrooms, bathrooms, floor, price, description, developerDescription, features,
seller, photos). `Property.pendingEdit` / `Property.editOutcome` in `src/lib/types.ts`. New photos in
an edit are uploaded to Vercel Blob when the host saves. A rejected edit's new photos stay in the
Blob store (like other orphaned uploads).

**Deploy order:** run `npm run db:setup` **before** deploying. Host saves on published listings and
the admin's approve/reject write the new columns. Reading is safe either way (missing columns read as
"no edit").

## Code map

| File | What it does |
| --- | --- |
| `src/lib/listing-edits.ts` | Pure: `HOST_EDIT_KEYS`, `pickHostEdit`, `holdsEdits` (published → held), `withPendingEdit` (form defaults), `diffEdit` / `fieldValue` (the comparison), `photoChanges`. |
| `src/lib/store.ts` ("Host edits") | `updateHostProperty` (in place, pending/needs changes only), `saveHostEdit` (held, published only), `approveHostEdit` / `rejectHostEdit` (only the version with the given `submittedAt`). |
| `src/lib/actions.ts` | `updateHostProperty` (photos, held or in place), `approveHostEdit`, `rejectHostEdit` (admin). |
| `src/components/host-edit-review.tsx` | The admin's side-by-side card with Approve / Reject. |
| `src/components/host-edit-form.tsx` | The host's edit form; `photo-picker.tsx` is shared with `/submit`. |
| `src/components/account-ui.tsx` | `EditStatus`: waiting / approved / not accepted, on `/account`. |

## Tests

- `src/lib/listing-edits.test.ts`: which fields a host edit carries, which statuses hold edits, the
  form defaults, and the comparison (unchanged, scalars, seller parts, feature order, photo order,
  cleared floor), plus added/removed photos.
- `src/lib/store.test.ts` ("host edits"): the SQL for in-place edits (never published listings, admin
  columns untouched), held edits (live columns and "Last updated" untouched), approve (only the
  version shown) and reject.
- `src/lib/actions.test.ts` ("host accounts: listings", "admin: host edits waiting for approval"):
  held vs in-place saves, photo order and uploads, photos that aren't the listing's own refused,
  ownership and status checks, the "changed meanwhile" answer, approving only the version shown,
  rejecting with a note, and admin-only access.
