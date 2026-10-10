import Link from "next/link";
import { EmptyState, LeadCard } from "@/components/admin-ui";
import { fmt, getDict } from "@/lib/i18n";
import { getLeads } from "@/lib/store";
import { LEAD_STATUSES } from "@/lib/types";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const digits = (s: string) => s.replace(/\D/g, "");

export default async function AdminLeadsPage({ searchParams }: PageProps<"/admin/leads">) {
  const [t, params, all] = await Promise.all([getDict(), searchParams, getLeads()]);
  const a = t.admin;
  const q = one(params.q).trim().toLowerCase();
  const status = LEAD_STATUSES.find((s) => s === params.status);
  const rentals = params.purpose === "rent";

  const leads = all.filter((l) => {
    if (status && l.status !== status) return false;
    if (rentals && !l.propertyCode?.startsWith("SKY-RNT")) return false;
    if (!q) return true;
    const haystack = [l.name, l.propertyCode, l.propertyTitle, l.email].join(" ").toLowerCase();
    if (haystack.includes(q)) return true;
    const qd = digits(q);
    return qd.length >= 3 && [l.phone, l.whatsapp].some((n) => digits(n).includes(qd));
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">{a.leadsTitle}</h1>
      <p className="mt-1 text-sm text-cocoa">{fmt(a.requestsOf, { shown: leads.length, total: all.length })}</p>

      <form className="card mt-5 flex flex-wrap gap-3 p-4">
        <input name="q" defaultValue={one(params.q)} placeholder={a.searchLeads} aria-label={t.search} className="field min-w-56 flex-1" />
        <select name="status" defaultValue={status ?? ""} aria-label={a.leadStatus} className="field w-auto">
          <option value="">{a.anyStatus}</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t.leadStatus[s]} ({all.filter((l) => l.status === s).length})
            </option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" name="purpose" value="rent" defaultChecked={rentals} className="h-4 w-4 accent-gold" />
          {a.rentalLeads}
        </label>
        <button type="submit" className="btn-primary">
          {t.search}
        </button>
        {(q || status || rentals) && (
          <Link href="/admin/leads" className="btn-outline">
            {t.clear}
          </Link>
        )}
      </form>

      <div className="mt-5 space-y-3">
        {leads.length ? leads.map((l) => <LeadCard key={`${l.id}-${l.updatedAt}`} lead={l} />) : <EmptyState>{a.noLeads}</EmptyState>}
      </div>
    </div>
  );
}
