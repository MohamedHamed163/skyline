"use client";

import { useActionState, useTransition } from "react";
import { PropertyFields } from "@/components/property-fields";
import { updateProperty } from "@/lib/actions";
import { useDict } from "@/lib/i18n/client";
import { withFailureMessage } from "@/lib/safe-action";
import type { Location, Property } from "@/lib/types";

export function EditPropertyForm({ property, locations }: { property: Property; locations: Location[] }) {
  const dict = useDict();
  const t = dict.admin;
  const [state, action, pending] = useActionState(withFailureMessage(updateProperty.bind(null, property.id), dict.msg.requestFailed), null);
  const [, startTransition] = useTransition();

  return (
    // Keyed on updatedAt so the fields show the saved values after each save. Submitted from
    // onSubmit (not <form action>) so a failed save keeps the user's edits instead of resetting.
    <form
      key={property.updatedAt}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="space-y-8"
    >
      <PropertyFields locations={locations} defaults={property} admin />
      <div>
        <label className="label" htmlFor="adminNotes">
          {t.internalNotes}
        </label>
        <textarea id="adminNotes" name="adminNotes" rows={3} maxLength={2000} defaultValue={property.adminNotes} className="field" />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? t.saving : t.saveChanges}
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
