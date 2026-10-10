"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { submitLead } from "@/lib/actions";
import { useDict } from "@/lib/i18n/client";
import { validEmail, validPhone } from "@/lib/validation";

type Field = "name" | "phone" | "whatsapp" | "email" | "message";
const EMPTY: Record<Field, string> = { name: "", phone: "", whatsapp: "", email: "", message: "" };

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

// Short lead form. When propertyId is set the request is tied to that property automatically.
export function LeadForm({ propertyId, startOpen = false }: { propertyId?: string; startOpen?: boolean }) {
  const t = useDict();
  const [state, action, pending] = useActionState(submitLead, null);
  const [clicked, setOpen] = useState(startOpen);
  // Controlled values survive React's form reset, so a server-side error doesn't wipe what was typed.
  const [values, setValues] = useState(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
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
  const required = (
    <span className="text-red-600" aria-hidden="true">
      *
    </span>
  );

  // Same rules as submitLead on the server.
  const v = { name: values.name.trim(), phone: values.phone.trim(), whatsapp: values.whatsapp.trim(), email: values.email.trim() };
  const errors: Partial<Record<Field, string>> = {
    name: v.name ? undefined : t.msg.nameRequired,
    phone: validPhone(v.phone) ? undefined : t.msg.badPhone,
    whatsapp: !v.whatsapp || validPhone(v.whatsapp) ? undefined : t.msg.badWhatsapp,
    email: !v.email || validEmail(v.email) ? undefined : t.msg.badEmail,
  };
  const valid = Object.values(errors).every((e) => !e);

  const bind = (field: Field) => ({
    id: `lead-${field}`,
    name: field,
    value: values[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((prev) => ({ ...prev, [field]: e.target.value })),
    onBlur: () => setTouched((prev) => ({ ...prev, [field]: true })),
    "aria-invalid": touched[field] && errors[field] ? true : undefined,
    "aria-describedby": touched[field] && errors[field] ? `lead-${field}-error` : undefined,
  });
  const fieldError = (field: Field) =>
    touched[field] && errors[field] ? (
      <p id={`lead-${field}-error`} className="mt-1 text-xs text-red-600">
        {errors[field]}
      </p>
    ) : null;

  return (
    <form action={action} className="space-y-4">
      {propertyId && <input type="hidden" name="propertyId" value={propertyId} />}
      <div>
        <label className="label" htmlFor="lead-name">
          {t.lead.name} {required}
        </label>
        <input {...bind("name")} required maxLength={80} autoComplete="name" autoFocus={!startOpen} className="field" />
        {fieldError("name")}
      </div>
      <div>
        <label className="label" htmlFor="lead-phone">
          {t.lead.phone} {required}
        </label>
        <input {...bind("phone")} type="tel" required maxLength={20} autoComplete="tel" placeholder={t.phonePlaceholder} dir="ltr" className="field" />
        {fieldError("phone")}
      </div>
      <div>
        <label className="label" htmlFor="lead-whatsapp">
          {t.lead.whatsapp} {optional}
        </label>
        <input {...bind("whatsapp")} type="tel" maxLength={20} dir="ltr" className="field" />
        {fieldError("whatsapp")}
      </div>
      <div>
        <label className="label" htmlFor="lead-email">
          {t.lead.email} {optional}
        </label>
        <input {...bind("email")} type="email" maxLength={120} autoComplete="email" dir="ltr" className="field" />
        {fieldError("email")}
      </div>
      <div>
        <label className="label" htmlFor="lead-message">
          {t.lead.message} {optional}
        </label>
        <textarea {...bind("message")} rows={3} maxLength={1000} className="field" />
      </div>
      {state && !state.ok && (
        <p className="text-sm text-red-600" role="alert">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending || !valid} className="btn-primary w-full">
        {pending ? t.lead.sending : t.lead.send}
      </button>
    </form>
  );
}
