import Link from "next/link";
import { EmptyState } from "@/components/admin-ui";
import { intlDigits, telHref, whatsappHref } from "@/lib/format";
import { fmt, getDict } from "@/lib/i18n";
import { getProperties } from "@/lib/store";
import type { Property, Seller } from "@/lib/types";

// Brokers and owners are derived from property submissions, grouped by phone number.
export default async function AdminSellersPage() {
  const [t, properties] = await Promise.all([getDict(), getProperties()]);
  const a = t.admin;
  const c = a.sellerColumns;
  const groups = new Map<string, { seller: Seller; properties: Property[] }>();
  for (const p of properties) {
    const key = intlDigits(p.seller.phone);
    const group = groups.get(key) ?? { seller: p.seller, properties: [] };
    group.properties.push(p);
    groups.set(key, group);
  }
  const sellers = [...groups.values()].sort((x, y) => y.properties.length - x.properties.length);

  return (
    <div>
      <h1 className="text-2xl font-bold">{a.sellersTitle}</h1>
      <p className="mt-1 text-sm text-cocoa">{fmt(a.sellersCount, { count: sellers.length })}</p>

      {sellers.length === 0 ? (
        <div className="mt-5">
          <EmptyState>{a.noSellers}</EmptyState>
        </div>
      ) : (
        <div className="card mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-ivory text-xs uppercase tracking-wide text-cocoa">
              <tr>
                {[c.name, c.type, c.company, c.phone, c.properties, c.published, c.contact].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-start font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sellers.map(({ seller, properties: list }) => (
                <tr key={seller.phone} className="hover:bg-ivory/60">
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{seller.name}</td>
                  <td className="px-4 py-3">{t.seller[seller.type]}</td>
                  <td className="whitespace-nowrap px-4 py-3">{seller.company || t.none}</td>
                  <td className="whitespace-nowrap px-4 py-3" dir="ltr">{seller.phone}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/properties?q=${encodeURIComponent(seller.phone)}`} className="font-semibold text-gold-deep hover:underline">
                      {list.length}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{list.filter((p) => p.status === "published").length}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <a href={telHref(seller.phone)} className="btn-outline btn-sm">
                        {t.call}
                      </a>
                      <a href={whatsappHref(seller.whatsapp || seller.phone)} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
                        {t.whatsapp}
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
