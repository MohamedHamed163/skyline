"use client";

import { useActionState, useState, useTransition } from "react";
import { PhotoPicker } from "@/components/photo-picker";
import { PropertyFields } from "@/components/property-fields";
import { ListingTypeChoice } from "@/components/property-form";
import { updateHostProperty } from "@/lib/actions";
import { useDict } from "@/lib/i18n/client";
import { MAX_PHOTOS } from "@/lib/photo-limits";
import { withFailureMessage } from "@/lib/safe-action";
import type { FormState, ListingType, Location, Property } from "@/lib/types";

// A host edits their own listing from /account (docs/host-edit-approval.md): the /submit fields and
// the photos, without documents. `property` is the listing with any waiting edit already applied
// (withPendingEdit), so the host continues from what they last sent. On a published listing the save
// is held for Skyline's approval; otherwise it goes straight onto the listing, which goes to review.
export function HostEditForm({ property, locations, version }: { property: Property; locations: Location[]; version: string }) {
  const dict = useDict();
  const [state, action, pending] = useActionState(withFailureMessage(updateHostProperty.bind(null, property.id), dict.msg.requestFailed), null);
  // Keyed on the saved version, so the fields (and photos, now URLs) show what was saved after each
  // save while the message above the button stays.
  return <EditFields key={version} property={property} locations={locations} action={action} pending={pending} state={state} />;
}

function EditFields({
  property,
  locations,
  action,
  pending,
  state,
}: {
  property: Property;
  locations: Location[];
  action: (fd: FormData) => void;
  pending: boolean;
  state: FormState;
}) {
  const dict = useDict();
  const t = dict.account;
  const [, startTransition] = useTransition();
  const [listingType, setListingType] = useState<ListingType>(property.listingType);
  // Photos the listing already has stay as URLs; new ones are added as JPEG data URLs.
  const [photos, setPhotos] = useState(property.photos);

  return (
    // Submitted from onSubmit (not <form action>) so a failed save keeps the host's edits.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        photos.forEach((p) => fd.append("photos", p));
        startTransition(() => action(fd));
      }}
      className="space-y-8"
    >
      <ListingTypeChoice value={listingType} onChange={setListingType} />
      <PropertyFields locations={locations} defaults={property} listingType={listingType} />
      <PhotoPicker photos={photos} onChange={setPhotos} limit={MAX_PHOTOS} />
      {state && (
        <p className={`rounded-xl px-4 py-3 text-sm ${state.ok ? "bg-success/10 text-success-deep" : "bg-red-50 text-red-700"}`} role={state.ok ? "status" : "alert"}>
          {state.message}
        </p>
      )}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <button type="submit" disabled={pending || photos.length === 0} className="btn-primary px-8 py-3">
          {pending ? t.saving : t.save}
        </button>
        {photos.length === 0 && <p className="text-sm text-cocoa">{dict.submit.addPhotoFirst}</p>}
      </div>
    </form>
  );
}
