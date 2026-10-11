# Primary or Resale on /submit, and Primary documents

When brokers and owners list a property at `/submit`, they first choose whether it is **Primary**
(a new unit from the developer) or **Resale**. A Resale submission has the same fields as before. A
Primary submission adds two optional uploads: the **project brochure** (PDF) and the **payment
plan** (PDF or Excel). Only the Skyline team sees these files.

## User behaviour (`/submit`)

- The form opens with "What are you listing?" and two cards, **Primary** and **Resale**, each with a
  one-line explanation. The rest of the form appears only after one is picked ("Choose one to
  continue."). The seller can switch at any time without losing what they typed.
- With **Primary** picked, a "Project documents" section appears under the photos:

  | Slot | Accepted files | Max size |
  | --- | --- | --- |
  | Project brochure | `.pdf` | 20 MB |
  | Payment plan | `.pdf`, `.xlsx`, `.xls` | 20 MB |

  Both slots are optional, and each holds one file. Picking a file uploads it straight away, with a
  progress bar. Once uploaded, the slot shows the file name, its size and a check mark, with
  **Replace** and **✕** (remove) buttons.
- A wrong type or a file that is too big is refused before anything is uploaded, with a message
  that names the file: "plan.docx can't be used here. Please choose a PDF or Excel file." or "big.pdf
  is larger than 20 MB. Please choose a smaller file." A failed upload says "Couldn't upload
  {file}. Check your connection and try again."
- **Submit for review** is disabled while a document is still uploading ("Wait for the documents
  to finish uploading.").
- Switching to **Resale** hides the documents section and never sends it. Switching back to
  Primary shows the uploads again.
- Everything is translated: Arabic labels are "برايمري" / "إعادة بيع", "بروشور المشروع" and
  "خطة السداد".

## Admin behaviour

- The property arrives as Pending with the seller's listing type. On approval a Primary listing
  gets a `SKY-PRM-…` code and a Resale one a `SKY-RES-…` code. The admin can still change the type
  in the edit form.
- The admin property page (`/admin/properties/[id]`) has a **Project documents** card, shown for
  Primary listings and for any property that has documents. Each document opens in a new tab and
  shows its kind and the seller's original file name. A Primary listing without documents shows
  "No documents were attached."
- Admin edits never change the documents. The admin "Add property" form has no document upload.
- Documents never appear on the public site. Like the seller's details, they are private.

## How uploads work

PDFs and spreadsheets are often larger than the 4 MB server-action body limit (and Vercel's 4.5 MB
function body limit), so documents don't go through the form submission. Instead:

1. The browser checks the extension and size (`checkDocument`).
2. `upload()` from `@vercel/blob/client` asks `POST /api/documents` for a client token. The route
   accepts only the paths `documents/brochure.pdf` and `documents/paymentPlan.{pdf,xlsx,xls}`
   (`uploadRules`). The token allows that one content type, at most 20 MB, adds a random suffix to
   the file name and expires after 10 minutes. Each IP can get 10 tokens per 10 minutes (see
   [rate-limiting.md](rate-limiting.md)).
3. The file goes straight from the browser to Vercel Blob. The resulting URL and original file name
   ride along with the form as hidden `brochureUrl` / `brochureName` and `paymentPlanUrl` /
   `paymentPlanName` fields.
4. `submitProperty` reads them only for Primary submissions (`readDocuments`). Each URL must be a
   public Blob URL of the right kind and type (`isDocumentUrl`). `verifyDocument` then calls Blob's
   `head()`, which only sees this app's store, to confirm that the file exists, its type is allowed
   and it is within the size limit. Any failure returns "One of the documents couldn't be attached.
   Please remove it and upload it again." and nothing is saved.

**Privacy.** The files are public Blob objects, like the property photos, but their URLs carry a
random suffix and are only rendered in the admin dashboard. The seller's file name is never part of
the URL. **Orphans.** A file uploaded by someone who then never submits stays in the Blob store.
Clear the `documents/` folder in the Vercel dashboard occasionally if it grows.

## Data model

`properties.documents jsonb NOT NULL DEFAULT '[]'`: a list of
`{ "kind": "brochure" | "paymentPlan", "url": "...", "name": "..." }`, written on creation only.
Existing rows get `[]`. `Property.documents` / `PropertyDocument` in `src/lib/types.ts`.

**Deploy order:** run `npm run db:setup` against the database **before** deploying this code.
Creating a property writes the `documents` column, so every submission fails until it exists.
Reading is safe either way (a missing column reads as no documents). `BLOB_READ_WRITE_TOKEN` is
already required for photos. No new environment variables are needed.

## Code map

| File | Role |
| --- | --- |
| `src/lib/types.ts` | `DOCUMENT_KINDS`, `DocumentKind`, `PropertyDocument`, `Property.documents`. |
| `src/lib/document-limits.ts` | Pure rules shared by browser, route and action: `MAX_DOCUMENT_MB` (20), `DOCUMENT_TYPES`, `acceptFor`, `documentContentType`, `checkDocument`, `documentPathname`, `uploadRules`, `isDocumentUrl`, `cleanDocumentName`, `readDocuments`, `sizeInMb`. |
| `src/lib/documents.ts` | Server-only `verifyDocument` (Blob `head()`). |
| `src/app/api/documents/route.ts` | Issues client upload tokens (rate limited, `uploadRules`). Refuses upload-completed callbacks, since none are registered. |
| `src/lib/rate-limit.ts` | `LIMITS.documentUpload`. |
| `src/lib/actions.ts` | `parseProperty` takes the seller's listing type (missing means resale, for forms opened before this change). `submitProperty` reads and verifies documents for Primary only. |
| `src/lib/store.ts` | Reads `documents`; `createProperty` writes them; `updateProperty` leaves them alone. |
| `src/components/property-form.tsx` | The Primary/Resale cards, the documents fieldset (hidden and disabled for Resale) and the submit button waiting for uploads. |
| `src/components/document-field.tsx` | One upload slot: checks, uploads with progress, replace/remove, hidden inputs. |
| `src/app/admin/(panel)/properties/[id]/page.tsx` | The "Project documents" card. |
| `src/components/icons.tsx` | `DocumentIcon`. |
| `src/lib/i18n/en.ts`, `ar.ts` | `submit.listingQuestion`, `submit.listingOptions`, `submit.chooseListing`, `submit.documents*`, the upload messages, `msg.documentFailed`, `admin.documents`, `admin.documentsPrivate`, `admin.noDocuments`, `admin.openDocument`, `documentKind`. |
| `src/lib/schema.sql` | The `documents` column. |

## Tests

- `src/lib/document-limits.test.ts`: allowed types per kind (including `constructor`-style
  extensions being refused), the exact 20 MB boundary, the type error reported before the size, upload
  paths built from kind and extension only, token rules for allowed paths and refusal of every
  other path (wrong kind/type, other folders, traversal), `isDocumentUrl` rejecting other hosts,
  look-alike hosts, http, ports, credentials, query strings, wrong kind/type and over-long URLs,
  file-name cleaning (control and direction characters, Arabic kept, length cap), `readDocuments`
  (none, both, one, missing name, bad URL), and `sizeInMb`.
- `src/lib/documents.test.ts`: `verifyDocument` with Blob `head()` mocked: accepted, too big, wrong
  type for the kind, lookup failure.
- `src/app/api/documents/route.test.ts`: a token limited to the type and size with a random suffix
  and a 10-minute expiry, refused paths, refused callbacks and non-JSON bodies, and the per-IP
  rate limit.
- `src/lib/actions.test.ts` → "seller's primary/resale choice and primary documents": both choices
  saved, a missing type saved as resale, an unknown type refused, both documents or just one saved
  with a Primary submission, documents ignored (and never checked) for Resale, a foreign URL or an
  unconfirmed file refused without saving or uploading photos, and admin edits leaving documents
  alone.
