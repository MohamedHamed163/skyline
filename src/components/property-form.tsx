"use client";

import { useActionState, useCallback, useState, useTransition } from "react";
import { DocumentField } from "@/components/document-field";
import { PropertyFields } from "@/components/property-fields";
import { createPropertyAdmin, submitProperty } from "@/lib/actions";
import { fmt, useDict } from "@/lib/i18n/client";
import { toJpegDataUrl } from "@/lib/jpeg";
import { MAX_DOCUMENT_MB } from "@/lib/document-limits";
import { checkPhotos, MAX_PHOTO_MB } from "@/lib/photo-limits";
import { withFailureMessage } from "@/lib/safe-action";
import { DOCUMENT_KINDS, LISTING_TYPES, type DocumentKind, type ListingType, type Location, type Purpose } from "@/lib/types";

const MAX_PHOTOS = 6;

// mode "public": broker/owner submission (sale only, goes to review). The seller first picks
// Primary or Resale; Primary adds the optional brochure and payment plan (docs/primary-documents.md).
// mode "admin": Skyline adds a property (sale or rent), published straight away.
export function PropertyForm({ mode, locations, defaultPurpose = "sale" }: { mode: "public" | "admin"; locations: Location[]; defaultPurpose?: Purpose }) {
  const t = useDict();
  const admin = mode === "admin";
  const [state, action, pending] = useActionState(withFailureMessage(admin ? createPropertyAdmin : submitProperty, t.msg.requestFailed), null);
  const [, startTransition] = useTransition();
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState("");
  const [listingType, setListingType] = useState<ListingType | null>(null);
  const [uploading, setUploading] = useState<DocumentKind[]>([]);
  const onDocumentBusy = useCallback(
    (kind: DocumentKind, busy: boolean) => setUploading((prev) => (busy === prev.includes(kind) ? prev : busy ? [...prev, kind] : prev.filter((k) => k !== kind))),
    [],
  );
  const primary = !admin && listingType === "primary";
  const waitForDocuments = primary && uploading.length > 0;

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    setPhotoError("");
    const { accepted: picked, tooLarge, overCount } = checkPhotos(Array.from(files), MAX_PHOTOS - photos.length);
    if (tooLarge.length) setPhotoError(fmt(t.submit.tooLarge, { mb: MAX_PHOTO_MB, files: tooLarge.join(", ") }));
    else if (overCount) setPhotoError(fmt(t.submit.maxPhotos, { max: MAX_PHOTOS }));
    try {
      const urls = await Promise.all(picked.map((f) => toJpegDataUrl(f)));
      setPhotos((prev) => [...prev, ...urls].slice(0, MAX_PHOTOS));
    } catch {
      setPhotoError(t.submit.badImage);
    }
  }

  if (state?.ok) {
    return (
      <div className="rounded-2xl border border-success/40 bg-success/10 p-8 text-center" role="status">
        <p className="text-xl font-bold">{t.submit.submitted}</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-cocoa">{state.message}</p>
        <button type="button" onClick={() => window.location.reload()} className="btn-outline mt-6">
          {t.submit.another}
        </button>
      </div>
    );
  }

  return (
    // Submitted from onSubmit rather than <form action>: React resets a form after its action
    // runs, which would wipe everything the user typed when the save fails.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        photos.forEach((p) => fd.append("photos", p));
        startTransition(() => action(fd));
      }}
      className="space-y-8"
    >
      {!admin && (
        <fieldset>
          <legend className="mb-4 text-lg font-bold">{t.submit.listingQuestion}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {LISTING_TYPES.map((v) => (
              <label
                key={v}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-ivory p-4 transition-colors hover:border-gold has-[:checked]:border-gold has-[:checked]:bg-gold/10 has-[:checked]:ring-1 has-[:checked]:ring-gold"
              >
                <input type="radio" name="listingType" value={v} required checked={listingType === v} onChange={() => setListingType(v)} className="mt-1 h-4 w-4 shrink-0 accent-gold" />
                <span>
                  <span className="block font-semibold">{t.listing[v]}</span>
                  <span className="block text-sm text-cocoa">{t.submit.listingOptions[v]}</span>
                </span>
              </label>
            ))}
          </div>
          {!listingType && <p className="mt-3 text-sm text-cocoa">{t.submit.chooseListing}</p>}
        </fieldset>
      )}

      {(admin || listingType) && (
        <>
          <PropertyFields locations={locations} admin={admin} defaultPurpose={defaultPurpose} listingType={listingType ?? undefined} />

          <fieldset>
            <legend className="mb-1 text-lg font-bold">{t.submit.images}</legend>
            <p className="mb-4 text-sm text-cocoa">{fmt(t.submit.imagesHint, { max: MAX_PHOTOS, mb: MAX_PHOTO_MB })}</p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {photos.map((src, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-xl border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={fmt(t.photoAlt, { n: i + 1 })} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={fmt(t.submit.removePhoto, { n: i + 1 })}
                    className="absolute end-1 top-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-espresso/80 text-xs text-white hover:bg-espresso"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line bg-ivory text-sm font-medium text-cocoa hover:border-gold hover:text-gold-deep">
                  <span className="text-2xl leading-none">+</span>
                  {t.submit.add}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      addPhotos(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
            {photoError && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {photoError}
              </p>
            )}
          </fieldset>

          {!admin && (
            // Kept mounted when Resale is picked, so switching back keeps the uploads; disabled, so a
            // Resale submission never sends them.
            <fieldset hidden={!primary} disabled={!primary}>
              <legend className="mb-1 text-lg font-bold">{t.submit.documents}</legend>
              <p className="mb-4 text-sm text-cocoa">{fmt(t.submit.documentsHint, { mb: MAX_DOCUMENT_MB })}</p>
              <div className="grid gap-4">
                {DOCUMENT_KINDS.map((kind) => (
                  <DocumentField key={kind} kind={kind} onBusy={onDocumentBusy} />
                ))}
              </div>
            </fieldset>
          )}

          {state && !state.ok && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {state.message}
            </p>
          )}

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <button type="submit" disabled={pending || photos.length === 0 || waitForDocuments} className="btn-primary px-8 py-3">
              {admin ? (pending ? t.admin.publishing : t.admin.publish) : pending ? t.submit.submitting : t.submit.submit}
            </button>
            <p className="text-sm text-cocoa">
              {photos.length === 0 ? t.submit.addPhotoFirst : waitForDocuments ? t.submit.waitForUploads : admin ? t.admin.newHint : t.submit.reviewNote}
            </p>
          </div>
        </>
      )}
    </form>
  );
}
