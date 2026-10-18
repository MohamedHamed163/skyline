"use client";

import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { CopyCode } from "@/components/copy-button";
import { Badge, STATUS_TONE, type TONES } from "@/components/status-badge";
import { setPropertyStatus, updateLead } from "@/lib/actions";
import { formatDate, telHref, whatsappHref } from "@/lib/format";
import { fmt, useDict } from "@/lib/i18n/client";
import { SETTABLE_LEAD_STATUSES, type Lead, type LeadStatus, type Property, type PropertyStatus } from "@/lib/types";

const LEAD_TONE: Record<LeadStatus, keyof typeof TONES> = {
  new: "amber",
  contacted: "blue",
  not_interested: "gray",
};

export function StatusBadge({ status }: { status: PropertyStatus }) {
  const t = useDict();
  return <Badge tone={STATUS_TONE[status]}>{t.status[status]}</Badge>;
}

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const t = useDict();
  return <Badge tone={LEAD_TONE[status]}>{t.leadStatus[status]}</Badge>;
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="card p-8 text-center text-sm text-cocoa">{children}</p>;
}

type ActionKey = "approve" | "reject" | "archive" | "sold" | "reserved" | "backToPublished" | "republish";
type Action = { status: PropertyStatus; label: ActionKey; style: "approve" | "danger" | "plain" };

const approve = (label: ActionKey = "approve"): Action => ({ status: "published", label, style: "approve" });
const SOLD: Action = { status: "sold", label: "sold", style: "plain" };
const ARCHIVE: Action = { status: "archived", label: "archive", style: "plain" };
const REJECT: Action = { status: "rejected", label: "reject", style: "danger" };

// Which status changes make sense from each status.
const NEXT_ACTIONS: Record<PropertyStatus, Action[]> = {
  pending: [approve(), REJECT],
  needs_changes: [approve(), REJECT],
  rejected: [approve(), ARCHIVE],
  published: [{ status: "reserved", label: "reserved", style: "plain" }, SOLD, ARCHIVE],
  reserved: [approve("backToPublished"), SOLD, ARCHIVE],
  sold: [approve("republish"), ARCHIVE],
  archived: [approve("republish")],
};

const ACTION_STYLES = {
  approve: "btn btn-sm bg-success text-deep hover:bg-success-dark",
  danger: "btn-outline btn-sm hover:border-red-400 hover:text-red-600",
  plain: "btn-outline btn-sm",
};

export function StatusActions({ property }: { property: Property }) {
  const t = useDict().admin.actions;
  return (
    <div className="flex flex-wrap gap-2">
      {NEXT_ACTIONS[property.status].map((a) => (
        <ActionForm key={a.status} action={setPropertyStatus.bind(null, property.id, a.status)}>
          <button type="submit" className={`whitespace-nowrap ${ACTION_STYLES[a.style]}`}>
            {t[a.label]}
          </button>
        </ActionForm>
      ))}
    </div>
  );
}

export function LeadCard({ lead }: { lead: Lead }) {
  const t = useDict();
  const a = t.admin;
  const name = lead.name.split(" ")[0];
  const waText = lead.propertyCode
    ? fmt(a.waGreeting, { name, code: lead.propertyCode })
    : fmt(a.waGreetingGeneral, { name });

  return (
    <article className="card grid gap-4 p-4 lg:grid-cols-[1fr_20rem]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{lead.name}</h3>
          <LeadStatusBadge status={lead.status} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          {lead.propertyCode && lead.propertyId ? (
            <>
              <CopyCode code={lead.propertyCode} />
              <Link href={`/admin/properties/${lead.propertyId}`} className="font-medium hover:text-gold-deep hover:underline">
                {lead.propertyTitle}
              </Link>
            </>
          ) : (
            <span className="text-cocoa">{a.generalInquiryNoProperty}</span>
          )}
        </div>
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div>
            <dt className="inline text-cocoa">{a.phone}: </dt>
            <dd className="inline font-medium" dir="ltr">{lead.phone}</dd>
          </div>
          <div>
            <dt className="inline text-cocoa">{a.whatsapp}: </dt>
            <dd className="inline font-medium" dir="ltr">{lead.whatsapp || t.none}</dd>
          </div>
          {lead.email && (
            <div>
              <dt className="inline text-cocoa">{a.email}: </dt>
              <dd className="inline font-medium" dir="ltr">{lead.email}</dd>
            </div>
          )}
          <div>
            <dt className="inline text-cocoa">{a.requested}: </dt>
            <dd className="inline font-medium">{formatDate(lead.createdAt, t.locale)}</dd>
          </div>
        </dl>
        {lead.message && <p dir="auto" className="mt-3 whitespace-pre-line rounded-lg bg-ivory p-3 text-start text-sm text-cocoa">{lead.message}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={telHref(lead.phone)} className="btn-primary btn-sm">
            📞 {t.call}
          </a>
          <a href={whatsappHref(lead.whatsapp || lead.phone, waText)} target="_blank" rel="noopener noreferrer" className="btn btn-sm bg-success text-deep hover:bg-success-dark">
            {t.whatsapp}
          </a>
        </div>
      </div>

      <ActionForm action={updateLead.bind(null, lead.id)} className="space-y-2">
        <label className="label" htmlFor={`status-${lead.id}`}>
          {a.leadStatus}
        </label>
        <select id={`status-${lead.id}`} name="status" defaultValue={lead.status === "new" ? "" : lead.status} className="field">
          {/* A new lead shows "New" until the admin picks one of the two statuses; it isn't offered in the list. */}
          <option value="" disabled hidden>
            {t.leadStatus.new}
          </option>
          {SETTABLE_LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t.leadStatus[s]}
            </option>
          ))}
        </select>
        <label className="label pt-1" htmlFor={`notes-${lead.id}`}>
          {a.internalNotes}
        </label>
        <textarea id={`notes-${lead.id}`} name="notes" rows={3} maxLength={2000} defaultValue={lead.notes} placeholder={a.notesPlaceholder} className="field" />
        <button type="submit" className="btn-dark btn-sm w-full">
          {t.save}
        </button>
      </ActionForm>
    </article>
  );
}
