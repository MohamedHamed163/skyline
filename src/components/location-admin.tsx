"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { ActionForm } from "@/components/action-form";
import { createLocation, setLocationArchived, updateLocation } from "@/lib/actions";
import { fmt, useDict } from "@/lib/i18n/client";
import { toJpegDataUrl } from "@/lib/jpeg";
import { DEFAULT_LOCATION_COVER, locationLabel } from "@/lib/locations";
import { withFailureMessage } from "@/lib/safe-action";
import type { FormState, Location } from "@/lib/types";

// Admin forms for /admin/locations. Without `location` the form adds a new one.
export function LocationForm({ location }: { location?: Location }) {
  const t = useDict();
  const l = t.admin.locations;
  const [cover, setCover] = useState("");
  const [removeCover, setRemoveCover] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const shown = cover || (removeCover ? "" : location?.cover);
  const prefix = location ? `loc-${location.id}` : "loc-new";
  const form = useRef<HTMLFormElement>(null);
  const [, startTransition] = useTransition();
  const save = withFailureMessage((prev: FormState, fd: FormData) => (location ? updateLocation(location.id, prev, fd) : createLocation(prev, fd)), t.msg.requestFailed);
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const result = await save(prev, fd);
    if (result?.ok) {
      setCover("");
      setRemoveCover(false);
      if (!location) form.current?.reset(); // clear the "add" form only once it has been added
    }
    return result;
  }, null);

  async function pick(file?: File) {
    if (!file) return;
    setPhotoError("");
    try {
      setCover(await toJpegDataUrl(file));
      setRemoveCover(false);
    } catch {
      setPhotoError(t.submit.badImage);
    }
  }

  return (
    // Submitted from onSubmit (not <form action>) so a failed save keeps what was typed.
    <form
      ref={form}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (cover) fd.set("cover", cover);
        if (removeCover) fd.set("removeCover", "on");
        startTransition(() => action(fd));
      }}
      className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
    >
      <div>
        <label className="label" htmlFor={`${prefix}-en`}>
          {l.nameEn}
        </label>
        <input id={`${prefix}-en`} name="nameEn" required maxLength={60} defaultValue={location?.nameEn} dir="ltr" className="field" />
      </div>
      <div>
        <label className="label" htmlFor={`${prefix}-ar`}>
          {l.nameAr}
        </label>
        <input id={`${prefix}-ar`} name="nameAr" required maxLength={60} defaultValue={location?.nameAr} dir="rtl" lang="ar" className="field" />
      </div>
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shown || DEFAULT_LOCATION_COVER} alt="" className={`h-11 w-16 rounded-lg object-cover ${shown ? "" : "opacity-40"}`} />
        <label className="btn-outline btn-sm cursor-pointer whitespace-nowrap">
          {l.choosePhoto}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {shown && (
          <button
            type="button"
            onClick={() => {
              setCover("");
              setRemoveCover(Boolean(location?.cover));
            }}
            className="btn-outline btn-sm whitespace-nowrap hover:border-red-400 hover:text-red-600"
          >
            {l.removePhoto}
          </button>
        )}
      </div>
      <p className="text-xs text-cocoa sm:col-span-3">{l.cover}: {l.coverHint}</p>
      {photoError && (
        <p className="text-sm text-red-600 sm:col-span-3" role="alert">
          {photoError}
        </p>
      )}
      <div className="flex items-center gap-3 sm:col-span-3">
        <button type="submit" disabled={pending} className="btn-primary btn-sm">
          {location ? (pending ? l.saving : l.save) : pending ? l.adding : `+ ${l.add}`}
        </button>
        {state && (
          <p className={`text-sm ${state.ok ? "text-success-deep" : "text-red-600"}`} role="status">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

/** Hide (with a confirmation that names the affected property count) or restore a location. */
export function LocationArchiveButton({ location, count }: { location: Location; count: number }) {
  const t = useDict();
  const l = t.admin.locations;
  const hide = !location.archived;
  return (
    <ActionForm action={setLocationArchived.bind(null, location.id, hide)} confirm={hide ? fmt(l.hideConfirm, { name: locationLabel(t, location), n: count }) : undefined}>
      <button type="submit" className={`btn-outline btn-sm whitespace-nowrap ${hide ? "hover:border-red-400 hover:text-red-600" : ""}`}>
        {hide ? l.hide : l.restore}
      </button>
    </ActionForm>
  );
}
