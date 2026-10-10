import Link from "next/link";
import { EmptyState, LeadStatusBadge, StatusBadge } from "@/components/admin-ui";
import { priceText } from "@/components/property-card";
import { formatDate, isToday } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { sellerWithType } from "@/lib/sellers";
import { getLeads, getProperties } from "@/lib/store";

export default async function AdminDashboardPage() {
  const [t, properties, leads] = await Promise.all([getDict(), getProperties(), getLeads()]);
  const a = t.admin;
  const count = (fn: (p: (typeof properties)[number]) => boolean) => properties.filter(fn).length;

  const stats = [
    { label: a.stats.total, value: properties.length, href: "/admin/properties" },
    { label: a.stats.published, value: count((p) => p.status === "published"), href: "/admin/properties?status=published" },
    { label: a.stats.pending, value: count((p) => p.status === "pending"), href: "/admin/properties?status=pending" },
    { label: a.stats.premium, value: count((p) => p.listingType === "premium"), href: "/admin/properties?listing=premium" },
    { label: a.stats.resale, value: count((p) => p.listingType === "resale"), href: "/admin/properties?listing=resale" },
    { label: a.stats.leadsToday, value: leads.filter((l) => isToday(l.createdAt)).length, href: "/admin/leads" },
    { label: a.stats.uncontacted, value: leads.filter((l) => l.status === "new").length, href: "/admin/leads?status=new" },
    { label: a.stats.sold, value: count((p) => p.status === "sold"), href: "/admin/properties?status=sold" },
    { label: a.nav.rentals, value: count((p) => p.purpose === "rent"), href: "/admin/properties?purpose=rent" },
  ];
  const arrow = t.dir === "rtl" ? "←" : "→";

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">{a.nav.dashboard}</h1>
        <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3">
          {stats.map((s) => (
            <Link key={s.label} href={s.href} className="card p-5 hover:border-gold">
              <p className="text-3xl font-extrabold">{s.value}</p>
              <p className="mt-1 text-sm text-cocoa">{s.label}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">{a.recentSubmissions}</h2>
            <Link href="/admin/properties" className="text-sm font-semibold text-gold-deep hover:underline">
              {a.allProperties} {arrow}
            </Link>
          </div>
          <div className="space-y-2">
            {properties.slice(0, 5).map((p) => (
              <Link key={p.id} href={`/admin/properties/${p.id}`} className="card flex items-center justify-between gap-3 p-4 hover:border-gold">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{p.title}</p>
                  <p className="truncate text-sm text-cocoa">
                    {p.purpose === "rent" ? t.purposeBadge.rent : t.listing[p.listingType]} · {priceText(t, p)} · {sellerWithType(t, p.seller)} ·{" "}
                    {formatDate(p.createdAt, t.locale)}
                  </p>
                </div>
                <StatusBadge status={p.status} />
              </Link>
            ))}
            {properties.length === 0 && <EmptyState>{a.noProperties}</EmptyState>}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">{a.recentRequests}</h2>
            <Link href="/admin/leads" className="text-sm font-semibold text-gold-deep hover:underline">
              {a.allLeads} {arrow}
            </Link>
          </div>
          <div className="space-y-2">
            {leads.slice(0, 5).map((l) => (
              <Link key={l.id} href={`/admin/leads?q=${encodeURIComponent(l.phone)}`} className="card flex items-center justify-between gap-3 p-4 hover:border-gold">
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {l.name} <span className="font-normal text-cocoa">· <span dir="ltr">{l.phone}</span></span>
                  </p>
                  <p className="truncate text-sm text-cocoa">
                    {l.propertyCode ? `${l.propertyCode} · ${l.propertyTitle}` : a.generalInquiry} · {formatDate(l.createdAt, t.locale)}
                  </p>
                </div>
                <LeadStatusBadge status={l.status} />
              </Link>
            ))}
            {leads.length === 0 && <EmptyState>{a.noRequests}</EmptyState>}
          </div>
        </section>
      </div>
    </div>
  );
}
