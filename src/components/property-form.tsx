"use client";

import { useActionState, useState, useTransition } from "react";
import { PropertyFields } from "@/components/property-fields";
import { createPropertyAdmin, submitProperty } from "@/lib/actions";
import { fmt, useDict } from "@/lib/i18n/client";
import { toJpegDataUrl } from "@/lib/jpeg";
import { withFailureMessage } from "@/lib/safe-action";
import type { Location, Purpose } from "@/lib/types";

const MAX_PHOTOS = 6;

// mode "public": broker/owner submission (sale only, goes to review).
// mode "admin": Skyline adds a property (sale or rent), published straight away.
export function PropertyForm({ mode, locations, defaultPurpose = "sale" }: { mode: "public" | "admin"; locations: Location[]; defaultPurpose?: Purpose }) {
  const t = useDict();
  const admin = mode === "admin";
  const [state, action, pending] = useActionState(withFailureMessage(admin ? createPropertyAdmin : submitProperty, t.msg.requestFailed), null);
  const [, startTransition] = useTransition();
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState("");

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    setPhotoError("");
    const room = MAX_PHOTOS - photos.length;
    const picked = Array.from(files).slice(0, room);
    if (files.length > room) setPhotoError(fmt(t.submit.maxPhotos, { max: MAX_PHOTOS }));
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
      <PropertyFields locations={locations} admin={admin} defaultPurpose={defaultPurpose} />

      <fieldset>
        <legend className="mb-1 text-lg font-bold">{t.submit.images}</legend>
        <p className="mb-4 text-sm text-cocoa">{fmt(t.submit.imagesHint, { max: MAX_PHOTOS })}</p>
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

      {state && !state.ok && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {state.message}
        </p>
      )}

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <button type="submit" disabled={pending || photos.length === 0} className="btn-primary px-8 py-3">
          {admin ? (pending ? t.admin.publishing : t.admin.publish) : pending ? t.submit.submitting : t.submit.submit}
        </button>
        <p className="text-sm text-cocoa">{photos.length === 0 ? t.submit.addPhotoFirst : admin ? t.admin.newHint : t.submit.reviewNote}</p>
      </div>
    </form>
  );
}
