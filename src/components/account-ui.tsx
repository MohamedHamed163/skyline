import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Photo, PurposeBadge, placeLabel, priceText } from "@/components/property-card";
import { Badge, STATUS_TONE } from "@/components/status-badge";
import { hostSignOut } from "@/lib/actions";
import { formatDate } from "@/lib/format";
import { canHostEdit } from "@/lib/host-accounts";
import { fmt, type Dict } from "@/lib/i18n";
import type { Host, Property } from "@/lib/types";

// Pieces of the host's /account pages (docs/host-accounts.md). Server components.

export function HostStatus({ t, p }: { t: Dict; p: Pick<Property, "status"> }) {
  return <Badge tone={STATUS_TONE[p.status]}>{t.status[p.status]}</Badge>;
}

/** The username, kept left-to-right inside Arabic text. */
export function HostName({ host, className = "font-semibold text-espresso" }: { host: Host; className?: string }) {
  return (
    <bdi className={className} dir="ltr">
      {host.username}
    </bdi>
  );
}

/** The property code, or a note that it comes with approval. */
export function HostCode({ t, p }: { t: Dict; p: Pick<Property, "code"> }) {
  return p.code ? (
    <span className="font-mono text-xs font-semibold" dir="ltr">
      {p.code}
    </span>
  ) : (
    <span className="text-xs text-cocoa">{t.account.codeOnApproval}</span>
  );
}

/** "Signed in as …" with links to the listings and a sign-out button. Shown above the /submit form. */
export function HostBar({ t, host }: { t: Dict; host: Host }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-cocoa">
        {t.account.signedInAs} <HostName host={host} />
      </p>
      <div className="flex items-center gap-2">
        <Link href="/account" className="btn-outline btn-sm">
          {t.account.back}
        </Link>
        <SignOutButton t={t} />
      </div>
    </div>
  );
}

export function SignOutButton({ t, light = false }: { t: Dict; light?: boolean }) {
  return (
    <ActionForm action={hostSignOut} errorClassName={`mt-1 text-xs ${light ? "text-error" : "text-red-600"}`}>
      <button
        type="submit"
        className={`btn btn-sm border ${light ? "border-cream/30 text-cream hover:border-gold hover:text-gold-light" : "border-line bg-white text-espresso hover:border-gold hover:text-gold-deep"}`}
      >
        {t.account.signOut}
      </button>
    </ActionForm>
  );
}

/**
 * Where the host's last edit to a published listing stands (docs/host-edit-approval.md): waiting for
 * Skyline, or approved / not accepted with Skyline's note. Nothing when there's no edit to report.
 */
export function EditStatus({ t, p, compact = false }: { t: Dict; p: Pick<Property, "pendingEdit" | "editOutcome">; compact?: boolean }) {
  const a = t.account;
  if (p.pendingEdit) {
    return <p className="rounded-lg bg-gold/15 px-3 py-1.5 text-xs font-medium text-gold-deep">{compact ? a.editWaitingShort : a.editWaiting}</p>;
  }
  const outcome = p.editOutcome;
  if (!outcome) return null;
  const approved = outcome.result === "approved";
  return (
    <p className={`rounded-lg px-3 py-1.5 text-xs font-medium ${approved ? "bg-success/10 text-success-deep" : "bg-red-50 text-red-700"}`}>
      {approved ? a.editApproved : a.editRejected}
      {outcome.note && (
        <>
          {" "}
          <span dir="auto">{fmt(a.editNote, { note: outcome.note })}</span>
        </>
      )}
    </p>
  );
}

/** One row of the host's listings: photo, status, code, price and the View / Edit buttons. */
export function HostListingRow({ t, p }: { t: Dict; p: Property }) {
  const href = `/account/listings/${p.id}`;
  return (
    <li className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <Link href={href} className="block aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl bg-line sm:w-40">
        <Photo src={p.photos[0]} alt={p.title} className="h-full w-full" />
      </Link>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <HostStatus t={t} p={p} />
          <PurposeBadge t={t} p={p} />
          <HostCode t={t} p={p} />
        </div>
        <h3 className="truncate font-semibold">
          <Link href={href} className="hover:text-gold-deep">
            {p.title}
          </Link>
        </h3>
        <p className="text-sm text-cocoa">
          {placeLabel(t, p)} · <span className="font-semibold text-espresso">{priceText(t, p)}</span>
        </p>
        <p className="text-xs text-cocoa">
          {t.account.statusHint[p.status]} · {fmt(t.account.sentOn, { date: formatDate(p.createdAt, t.locale) })}
        </p>
        <EditStatus t={t} p={p} compact />
      </div>
      <div className="flex shrink-0 gap-2">
        <Link href={href} className="btn-outline btn-sm">
          {t.account.view}
        </Link>
        {canHostEdit(p) && (
          <Link href={`${href}/edit`} className="btn-primary btn-sm">
            {p.pendingEdit ? t.account.editChanges : t.account.edit}
          </Link>
        )}
      </div>
    </li>
  );
}
