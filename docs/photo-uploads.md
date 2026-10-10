# Photo uploads

Every image upload field accepts photos of up to **6 MB each**. A larger file is rejected in the
browser with a friendly message naming it, so the user knows which photo to replace, and nothing is
sent to the server.

## Where it applies

| Field | Behaviour |
| --- | --- |
| Property photos (`/submit` and the admin "new property" form) | Up to 6 photos. Oversized files are skipped; the others in the same pick are still added. An oversized file never uses up one of the 6 slots. |
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

## Data model

No schema change.

## Code map

| File | Role |
| --- | --- |
| `src/lib/photo-limits.ts` | `MAX_PHOTO_MB`, `MAX_PHOTO_BYTES` and `checkPhotos(files, room)`, which returns the accepted files, the names of oversized ones and whether there were more fitting files than room. Pure, no DOM. |
| `src/components/property-form.tsx` | Uses `checkPhotos` in `addPhotos`. |
| `src/components/location-admin.tsx` | Uses `checkPhotos` in `pick`. |
| `src/lib/i18n/en.ts`, `ar.ts` | `submit.tooLarge`, and the `{mb}` placeholder in `submit.imagesHint` and `admin.locations.coverHint`. |

To change the limit, edit `MAX_PHOTO_MB`; the messages and hints follow it.

## Tests

`src/lib/photo-limits.test.ts`: the exact 6 MB boundary, oversized files dropped and named,
oversized files not taking a slot, the over-count flag, and no room left.
