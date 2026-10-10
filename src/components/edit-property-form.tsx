"use client";

import { useActionState } from "react";
import { PropertyFields } from "@/components/property-fields";
import { updateProperty } from "@/lib/actions";
import { useDict } from "@/lib/i18n/client";
import type { Property } from "@/lib/types";

export function EditPropertyForm({ property }: { property: Property }) {
  const t = useDict().admin;
  const [state, action, pending] = useActionState(updateProperty.bind(null, property.id), null);

  return (
    // Keyed on updatedAt so the fields show the saved values after each save.
    <form key={property.updatedAt} action={action} className="space-y-8">
      <PropertyFields defaults={property} admin />
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
