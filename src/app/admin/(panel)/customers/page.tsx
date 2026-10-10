import Link from "next/link";
import { EmptyState } from "@/components/admin-ui";
import { formatDate, intlDigits, telHref, whatsappHref } from "@/lib/format";
import { fmt, getDict } from "@/lib/i18n";
import { getLeads } from "@/lib/store";
import type { Lead } from "@/lib/types";

// Customers are derived from leads, grouped by phone number (leads arrive newest first).
export default async function AdminCustomersPage() {
  const [t, all] = await Promise.all([getDict(), getLeads()]);
  const a = t.admin;
  const c = a.customerColumns;
  const groups = new Map<string, Lead[]>();
  for (const lead of all) {
    const key = intlDigits(lead.phone);
    groups.set(key, [...(groups.get(key) ?? []), lead]);
  }
  const customers = [...groups.values()];

  return (
    <div>
      <h1 className="text-2xl font-bold">{a.customersTitle}</h1>
      <p className="mt-1 text-sm text-cocoa">{fmt(a.customersCount, { count: customers.length })}</p>

      {customers.length === 0 ? (
        <div className="mt-5">
          <EmptyState>{a.noCustomers}</EmptyState>
        </div>
      ) : (
        <div className="card mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-ivory text-xs uppercase tracking-wide text-cocoa">
              <tr>
                {[c.name, c.phone, c.whatsapp, c.email, c.requests, c.last, c.contact].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-start font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {customers.map((leads) => {
                const latest = leads[0];
                const whatsapp = leads.find((l) => l.whatsapp)?.whatsapp ?? "";
                return (
                  <tr key={latest.id} className="hover:bg-ivory/60">
                    <td className="whitespace-nowrap px-4 py-3 font-semibold">{latest.name}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span dir="ltr">{latest.phone}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span dir="ltr">{whatsapp || t.none}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span dir="ltr">{leads.find((l) => l.email)?.email ?? t.none}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/leads?q=${encodeURIComponent(latest.phone)}`} className="font-semibold text-gold-deep hover:underline">
                        {leads.length}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-cocoa">{formatDate(latest.createdAt, t.locale)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <a href={telHref(latest.phone)} className="btn-outline btn-sm">
                          {t.call}
                        </a>
                        <a href={whatsappHref(whatsapp || latest.phone)} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
                          {t.whatsapp}
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
