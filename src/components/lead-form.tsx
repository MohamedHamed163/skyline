"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { submitLead } from "@/lib/actions";
import { useDict } from "@/lib/i18n/client";

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

// Short lead form. When propertyId is set the request is tied to that property automatically.
export function LeadForm({ propertyId, startOpen = false }: { propertyId?: string; startOpen?: boolean }) {
  const t = useDict();
  const [state, action, pending] = useActionState(submitLead, null);
  const [clicked, setOpen] = useState(startOpen);
  // "Request details" links land on #request: open the form straight away.
  const hashOpen = useSyncExternalStore(subscribeHash, () => window.location.hash === "#request", () => false);
  const open = clicked || hashOpen;

  if (state?.ok) {
    return (
      <div className="rounded-xl border border-success/40 bg-success/10 p-4 text-sm font-semibold" role="status">
        {state.message}
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-primary w-full py-3 text-base">
        {t.lead.request}
      </button>
    );
  }

  const optional = <span className="font-normal text-cocoa">{t.optional}</span>;

  return (
    <form action={action} className="space-y-4">
      {propertyId && <input type="hidden" name="propertyId" value={propertyId} />}
      <div>
        <label className="label" htmlFor="lead-name">
          {t.lead.name}
        </label>
        <input id="lead-name" name="name" required maxLength={80} autoComplete="name" autoFocus={!startOpen} className="field" />
      </div>
      <div>
        <label className="label" htmlFor="lead-phone">
          {t.lead.phone}
        </label>
        <input id="lead-phone" name="phone" type="tel" required maxLength={20} autoComplete="tel" placeholder={t.phonePlaceholder} dir="ltr" className="field" />
      </div>
      <div>
        <label className="label" htmlFor="lead-whatsapp">
          {t.lead.whatsapp} {optional}
        </label>
        <input id="lead-whatsapp" name="whatsapp" type="tel" maxLength={20} dir="ltr" className="field" />
      </div>
      <div>
        <label className="label" htmlFor="lead-email">
          {t.lead.email} {optional}
        </label>
        <input id="lead-email" name="email" type="email" maxLength={120} autoComplete="email" dir="ltr" className="field" />
      </div>
      <div>
        <label className="label" htmlFor="lead-message">
          {t.lead.message} {optional}
        </label>
        <textarea id="lead-message" name="message" rows={3} maxLength={1000} className="field" />
      </div>
      {state && !state.ok && (
        <p className="text-sm text-red-600" role="alert">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? t.lead.sending : t.lead.send}
      </button>
    </form>
  );
}
