# Photo uploads

Every image upload field accepts photos of up to **6 MB each**. A larger file is rejected in the
browser with a friendly message naming it, so the user knows which photo to replace, and nothing is
sent to the server. A property can have **up to 8 photos**, for Primary and Resale listings alike.

## Where it applies

| Field | Behaviour |
| --- | --- |
| Property photos (`/submit` and the admin "new property" form) | 1 to 8 photos; the first is the main image. Oversized files are skipped; the others in the same pick are still added. An oversized file never uses up one of the 8 slots. Picking more than the free slots adds the first ones and says "You can add up to 8 photos." The server action refuses 0 or more than 8 with "Please add between 1 and 8 photos." |
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

## Fitting 8 photos in one request

The 4 MB body limit sits just under Vercel's 4.5 MB request cap, so it can't simply be raised. Instead
each property photo is kept under an equal share of a 3.6 MB photo budget (`PHOTO_TARGET_CHARS`,
450,000 data-URL characters, about 330 KB of JPEG), which leaves room for the text fields even with
all 8 photos. Most photos fit at the usual 1280px / quality 0.72; a very detailed one is re-encoded
at quality 0.6, then at 1024px, then at 800px, stopping at the first that fits (`JPEG_STEPS`,
`encodeWithin`). The location cover photo is sent alone, so it has no budget and keeps full quality.

If `MAX_PHOTOS` changes, `PHOTO_TARGET_CHARS` follows it, so each photo gets a smaller or larger
share; the budget test fails if the total no longer fits under 4 MB.

## Data model

No schema change.

## Code map

| File | Role |
| --- | --- |
| `src/lib/photo-limits.ts` | `MAX_PHOTO_MB`, `MAX_PHOTO_BYTES` and `checkPhotos(files, room)`, which returns the accepted files, the names of oversized ones and whether there were more fitting files than room. Also `MAX_PHOTOS` (8, shared by the form and the server actions), `PHOTO_TARGET_CHARS`, `JPEG_STEPS` and `encodeWithin`. Pure, no DOM. |
| `src/lib/jpeg.ts` | `toJpegDataUrl(file, maxChars)`: draws the photo on a canvas for each `JPEG_STEPS` entry until it fits. |
| `src/components/property-form.tsx` | Uses `checkPhotos` and `toJpegDataUrl(f, PHOTO_TARGET_CHARS)` in `addPhotos`. Photos sit in a 4-column grid (8 per row from `md`). |
| `src/lib/actions.ts` | `submitProperty` and `createPropertyAdmin` refuse 0 or more than `MAX_PHOTOS` photos. |
| `src/components/location-admin.tsx` | Uses `checkPhotos` in `pick`. |
| `src/lib/i18n/en.ts`, `ar.ts` | `submit.tooLarge`, and the `{mb}` placeholder in `submit.imagesHint` and `admin.locations.coverHint`. |

To change the size limit, edit `MAX_PHOTO_MB`; to change the photo count, edit `MAX_PHOTOS`. The
messages and hints follow both.

## Tests

`src/lib/photo-limits.test.ts`: the exact 6 MB boundary, oversized files dropped and named,
oversized files not taking a slot, the over-count flag, no room left, 8 photos fitting under the
4 MB body limit, and `encodeWithin` lowering quality before size and falling back to the smallest
attempt.

`src/lib/actions.test.ts` ("photo count"): public and admin listings accept 8 photos and refuse 9
or none without uploading anything.
