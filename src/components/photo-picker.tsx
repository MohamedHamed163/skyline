"use client";

import { useState } from "react";
import { fmt, useDict } from "@/lib/i18n/client";
import { toJpegDataUrl } from "@/lib/jpeg";
import { checkPhotos, fitBudget, MAX_PHOTO_MB, photoTargetChars } from "@/lib/photo-limits";

/**
 * The "Property images" section of the property forms (docs/photo-uploads.md). New photos are
 * downscaled to JPEG data URLs within the shared upload budget; photos a listing already has stay as
 * their URLs (host edits, docs/host-edit-approval.md). The first photo is the main image.
 */
export function PhotoPicker({ photos, onChange, limit }: { photos: string[]; onChange: React.Dispatch<React.SetStateAction<string[]>>; limit: number }) {
  const t = useDict();
  const [photoError, setPhotoError] = useState("");

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    setPhotoError("");
    const { accepted: picked, tooLarge, overCount } = checkPhotos(Array.from(files), limit - photos.length);
    if (tooLarge.length) setPhotoError(fmt(t.submit.tooLarge, { mb: MAX_PHOTO_MB, files: tooLarge.join(", ") }));
    else if (overCount) setPhotoError(fmt(t.submit.maxPhotos, { max: limit }));
    const used = photos.reduce((n, p) => n + p.length, 0);
    try {
      const urls = await Promise.all(picked.map((f) => toJpegDataUrl(f, photoTargetChars(used, photos.length, limit))));
      const kept = fitBudget(urls, used);
      if (kept.length < urls.length) setPhotoError(t.submit.photosFull);
      onChange((prev) => [...prev, ...kept].slice(0, limit));
    } catch {
      setPhotoError(t.submit.badImage);
    }
  }

  return (
    <fieldset>
      <legend className="mb-1 text-lg font-bold">{t.submit.images}</legend>
      <p className="mb-4 text-sm text-cocoa">{fmt(t.submit.imagesHint, { max: limit, mb: MAX_PHOTO_MB })}</p>
      <div className="grid grid-cols-4 gap-3 md:grid-cols-8">
        {photos.map((src, i) => (
          <div key={i} className="relative aspect-square overflow-hidden rounded-xl border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={fmt(t.photoAlt, { n: i + 1 })} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange((prev) => prev.filter((_, j) => j !== i))}
              aria-label={fmt(t.submit.removePhoto, { n: i + 1 })}
              className="absolute end-1 top-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-espresso/80 text-xs text-white hover:bg-espresso"
            >
              ✕
            </button>
          </div>
        ))}
        {photos.length < limit && (
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
  );
}
