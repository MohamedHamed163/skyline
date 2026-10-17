# Photo uploads

Every image upload field accepts photos of up to **6 MB each**. A larger file is rejected in the
browser with a friendly message naming it, so the user knows which photo to replace, and nothing is
sent to the server. A sale listing can have **up to 8 photos** (Primary and Resale alike) and a
rental **up to 15**.

## Where it applies

| Field | Behaviour |
| --- | --- |
| Property photos (`/submit` and the admin "new property" form) | 1 to 8 photos for a sale listing, 1 to 15 for a rental; the first is the main image. Oversized files are skipped; the others in the same pick are still added. An oversized file never uses up a slot. Picking more than the free slots adds the first ones and says "You can add up to 8 photos." (or 15). The server action refuses 0 or too many with "Please add between 1 and 8 photos." (or 15). |
| Switching purpose (admin "new property" form) | The limit and the hint follow the Sale / Rent choice as soon as it changes. A rental with more than 8 photos switched to Sale keeps its photos, but Publish is disabled with "This listing can have up to 8 photos. Remove 3 to continue." until enough are removed. |
| Location cover photo (`/admin/locations`) | One optional photo. An oversized file is rejected and the current cover is kept. |

Both hints under the fields say "up to 6 MB", in English and Arabic.

Message (`t.submit.tooLarge`):

- EN: "Each photo must be 6 MB or smaller. Please choose a smaller version of: big.jpg."
- AR: "يجب ألا يزيد حجم كل صورة عن 6 ميغابايت. يُرجى اختيار نسخة أصغر من: big.jpg."

If a pick has both oversized files and more photos than free slots, the size message is shown.

## Why the limit is on the original file

Accepted photos are downscaled in the browser to a ≤1280px JPEG (`src/lib/jpeg.ts`) before they
are sent, so the server-action body stays under `bodySizeLimit` (4 MB) in `next.config.ts`. The
6 MB limit stops very large originals (which are slow to decode, especially on phones) before that
step. It is a client-side check; the server only ever receives the downscaled JPEGs.

## Fitting all the photos in one request

The 4 MB body limit sits just under Vercel's 4.5 MB request cap, so it can't simply be raised. Instead
the photos share a 3.6 MB budget (`PHOTO_BODY_BUDGET`), which leaves room for the text fields. Each
newly picked photo is kept under an equal share of what is left of the budget across the free slots
(`photoTargetChars`). On an empty form that is 450,000 data-URL characters (about 330 KB of JPEG)
for a sale listing and 240,000 (about 175 KB) for a rental. A photo that comes in under its share
leaves more for the ones after it.

Most photos fit at the usual 1280px / quality 0.72; a very detailed one is re-encoded at quality 0.6,
then at 1024px, then at 800px, stopping at the first that fits (`JPEG_STEPS`, `encodeWithin`). With
15 photos, rentals more often land on one of the smaller steps. The location cover photo is sent
alone, so it has no budget and keeps full quality.

If a sale listing already used most of the budget and is then switched to Rent, the extra slots get
only a small share. Any new photo that would push the total over the budget is not added, and the
form says "There's no room left for more photos in this upload. Remove a photo to add another."
(`fitBudget`).

If `MAX_PHOTOS` or `MAX_RENTAL_PHOTOS` changes, the shares follow it. The budget tests fail if a full
set no longer fits under 4 MB.

## Data model

No schema change.

## Code map

| File | Role |
| --- | --- |
| `src/lib/photo-limits.ts` | `MAX_PHOTO_MB`, `MAX_PHOTO_BYTES` and `checkPhotos(files, room)`, which returns the accepted files, the names of oversized ones and whether there were more fitting files than room. Also `MAX_PHOTOS` (8, sale), `MAX_RENTAL_PHOTOS` (15) and `maxPhotos(purpose)`, shared by the form and the server actions; `PHOTO_BODY_BUDGET`, `photoTargetChars(used, count, limit)`, `fitBudget(added, used)`, `JPEG_STEPS` and `encodeWithin`. Pure, no DOM. |
| `src/lib/jpeg.ts` | `toJpegDataUrl(file, maxChars)`: draws the photo on a canvas for each `JPEG_STEPS` entry until it fits. |
| `src/components/property-form.tsx` | Tracks the purpose to pick the limit. `addPhotos` uses `checkPhotos`, `toJpegDataUrl(f, photoTargetChars(...))` and `fitBudget`. Disables Publish while a listing has more photos than its limit. Photos sit in a 4-column grid (8 per row from `md`). |
| `src/components/property-fields.tsx` | `onPurposeChange` tells the form when the admin switches between Sale and Rent. |
| `src/lib/actions.ts` | `submitProperty` (always a sale) refuses 0 or more than `MAX_PHOTOS` photos; `createPropertyAdmin` refuses 0 or more than `maxPhotos(purpose)`. |
| `src/components/location-admin.tsx` | Uses `checkPhotos` in `pick`. |
| `src/lib/i18n/en.ts`, `ar.ts` | `submit.tooLarge`, `submit.tooManyPhotos`, `submit.photosFull`, and the `{mb}` placeholder in `submit.imagesHint` and `admin.locations.coverHint`. |

To change the size limit, edit `MAX_PHOTO_MB`; to change the photo count, edit `MAX_PHOTOS` (sale)
or `MAX_RENTAL_PHOTOS`. The messages and hints follow them.

## Tests

`src/lib/photo-limits.test.ts`: the exact 6 MB boundary, oversized files dropped and named,
oversized files not taking a slot, the over-count flag, no room left; 8 photos for sale and 15 for
rent; the budget leaving room under the 4 MB body limit, each photo's share of what is left, and a
full set of 8 or 15 fitting whether picked one by one or all at once; `fitBudget` keeping photos
in order until the budget is full; and `encodeWithin` lowering quality before size and falling back
to the smallest attempt.

`src/lib/actions.test.ts` ("photo count"): public and admin sale listings accept 8 photos and refuse
9 or none; admin rentals accept 15 and refuse 16 or none, without uploading anything; a public
submission that claims to be a rental is still held to 8.
