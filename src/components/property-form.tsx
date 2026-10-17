"use client";

import Link from "next/link";
import { useActionState, useCallback, useState, useTransition } from "react";
import { DocumentField } from "@/components/document-field";
import { PhotoPicker } from "@/components/photo-picker";
import { PropertyFields } from "@/components/property-fields";
import { createPropertyAdmin, submitProperty } from "@/lib/actions";
import type { Day } from "@/lib/availability";
import { fmt, useDict } from "@/lib/i18n/client";
import { MAX_DOCUMENT_MB } from "@/lib/document-limits";
import { maxPhotos } from "@/lib/photo-limits";
import { withFailureMessage } from "@/lib/safe-action";
import { DOCUMENT_KINDS, LISTING_TYPES, type DocumentKind, type ListingType, type Location, type Purpose } from "@/lib/types";

// mode "public": broker/owner submission (sale only, goes to review). The seller first picks
// Primary or Resale; Primary adds the optional brochure and payment plan (docs/primary-documents.md).
// mode "admin": Skyline adds a property (sale or rent), published straight away. `today` (Cairo)
// drives the rental special-price calendar. Rentals take more photos than sales (docs/photo-uploads.md).
export function PropertyForm({ mode, locations, defaultPurpose = "sale", today }: { mode: "public" | "admin"; locations: Location[]; defaultPurpose?: Purpose; today?: Day }) {
  const t = useDict();
  const admin = mode === "admin";
  const [state, action, pending] = useActionState(withFailureMessage(admin ? createPropertyAdmin : submitProperty, t.msg.requestFailed), null);
  const [, startTransition] = useTransition();
  const [photos, setPhotos] = useState<string[]>([]);
  const [purpose, setPurpose] = useState<Purpose>(admin ? defaultPurpose : "sale");
  const limit = maxPhotos(purpose);
  // A rental switched back to a sale can hold more photos than a sale allows.
  const extraPhotos = Math.max(0, photos.length - limit);
  const [listingType, setListingType] = useState<ListingType | null>(null);
  const [uploading, setUploading] = useState<DocumentKind[]>([]);
  const onDocumentBusy = useCallback(
    (kind: DocumentKind, busy: boolean) => setUploading((prev) => (busy === prev.includes(kind) ? prev : busy ? [...prev, kind] : prev.filter((k) => k !== kind))),
    [],
  );
  const primary = !admin && listingType === "primary";
  const waitForDocuments = primary && uploading.length > 0;

  if (state?.ok) {
    return (
      <div className="rounded-2xl border border-success/40 bg-success/10 p-8 text-center" role="status">
        <p className="text-xl font-bold">{t.submit.submitted}</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-cocoa">{state.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {/* Brokers and owners see the listing in their account (docs/host-accounts.md). */}
          {!admin && (
            <Link href="/account" className="btn-primary">
              {t.account.toAccount}
            </Link>
          )}
          <button type="button" onClick={() => window.location.reload()} className="btn-outline">
            {t.submit.another}
          </button>
        </div>
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
      {!admin && <ListingTypeChoice value={listingType} onChange={setListingType} />}

      {(admin || listingType) && (
        <>
          <PropertyFields locations={locations} admin={admin} defaultPurpose={defaultPurpose} listingType={listingType ?? undefined} today={today} onPurposeChange={setPurpose} />

          <PhotoPicker photos={photos} onChange={setPhotos} limit={limit} />

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
            <button type="submit" disabled={pending || photos.length === 0 || extraPhotos > 0 || waitForDocuments} className="btn-primary px-8 py-3">
              {admin ? (pending ? t.admin.publishing : t.admin.publish) : pending ? t.submit.submitting : t.submit.submit}
            </button>
            <p className="text-sm text-cocoa">
              {photos.length === 0
                ? t.submit.addPhotoFirst
                : extraPhotos
                  ? fmt(t.submit.tooManyPhotos, { max: limit, extra: extraPhotos })
                  : waitForDocuments
                    ? t.submit.waitForUploads
                    : admin
                      ? t.admin.newHint
                      : t.submit.reviewNote}
            </p>
          </div>
        </>
      )}
    </form>
  );
}

/** "What are you listing?": Primary or Resale, picked by the broker or owner on /submit and when editing from /account. */
export function ListingTypeChoice({ value, onChange }: { value: ListingType | null; onChange: (v: ListingType) => void }) {
  const t = useDict();
  return (
    <fieldset>
      <legend className="mb-4 text-lg font-bold">{t.submit.listingQuestion}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {LISTING_TYPES.map((v) => (
          <label
            key={v}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-ivory p-4 transition-colors hover:border-gold has-[:checked]:border-gold has-[:checked]:bg-gold/10 has-[:checked]:ring-1 has-[:checked]:ring-gold"
          >
            <input type="radio" name="listingType" value={v} required checked={value === v} onChange={() => onChange(v)} className="mt-1 h-4 w-4 shrink-0 accent-gold" />
            <span>
              <span className="block font-semibold">{t.listing[v]}</span>
              <span className="block text-sm text-cocoa">{t.submit.listingOptions[v]}</span>
            </span>
          </label>
        ))}
      </div>
      {!value && <p className="mt-3 text-sm text-cocoa">{t.submit.chooseListing}</p>}
    </fieldset>
  );
}
