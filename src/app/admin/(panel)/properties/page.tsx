import Link from "next/link";
import { EmptyState, StatusActions, StatusBadge } from "@/components/admin-ui";
import { CopyCode } from "@/components/copy-button";
import { priceText } from "@/components/property-card";
import { formatDay } from "@/lib/format";
import { fmt, getDict } from "@/lib/i18n";
import { sellerName } from "@/lib/sellers";
import { locationLabel, localName } from "@/lib/locations";
import { getLocations, getProperties } from "@/lib/store";
import { LISTING_TYPES, PROPERTY_STATUSES, PROPERTY_TYPES, PURPOSES, SELLER_TYPES, toListingType } from "@/lib/types";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const digits = (s: string) => s.replace(/\D/g, "");

export default async function AdminPropertiesPage({ searchParams }: PageProps<"/admin/properties">) {
  const [t, params, all, locations] = await Promise.all([getDict(), searchParams, getProperties(), getLocations()]);
  const a = t.admin;
  const q = one(params.q).trim().toLowerCase();
  const listing = toListingType(one(params.listing));
  // "inactive" is the Archived / Sold view from the sidebar.
  const statusParam = one(params.status);
  const status = PROPERTY_STATUSES.find((s) => s === statusParam);
  const inactive = statusParam === "inactive";
  const type = PROPERTY_TYPES.find((v) => v === params.type);
  const location = locations.find((l) => l.id === params.location)?.id;
  const compound = one(params.compound);
  const seller = SELLER_TYPES.find((v) => v === params.seller);
  const purpose = PURPOSES.find((v) => v === params.purpose);

  const compounds = [...new Set(all.map((p) => p.compound).filter(Boolean))].sort();

  const matchesSearch = (p: (typeof all)[number]) => {
    if (!q) return true;
    const haystack = [p.code, p.title, p.compound, p.seller.name, p.seller.company].join(" ").toLowerCase();
    if (haystack.includes(q)) return true;
    const qd = digits(q);
    return qd.length >= 3 && [p.seller.phone, p.seller.whatsapp].some((n) => digits(n).includes(qd));
  };

  const rows = all.filter(
    (p) =>
      matchesSearch(p) &&
      (!listing || p.listingType === listing) &&
      (!status || p.status === status) &&
      (!inactive || p.status === "sold" || p.status === "archived") &&
      (!type || p.type === type) &&
      (!location || p.location === location) &&
      (!compound || p.compound === compound) &&
      (!seller || p.seller.type === seller) &&
      (!purpose || p.purpose === purpose),
  );

  const filtered = Boolean(q || listing || statusParam || type || location || compound || seller || purpose);
  const c = a.columns;
  const headers = [c.code, c.title, c.type, c.listing, c.compound, c.location, c.price, c.seller, c.status, c.created, c.updated, c.actions];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{purpose === "rent" ? a.nav.rentals : a.propertiesTitle}</h1>
          <p className="mt-1 text-sm text-cocoa">{fmt(a.ofCount, { shown: rows.length, total: all.length })}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/properties/new" className="btn-outline btn-sm">
            + {a.addProperty}
          </Link>
          <Link href="/admin/properties/new?purpose=rent" className="btn-primary btn-sm">
            + {a.addRental}
          </Link>
        </div>
      </div>

      <form className="card mt-5 grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
        <input name="q" defaultValue={one(params.q)} placeholder={a.searchProperties} aria-label={t.search} className="field col-span-2 md:col-span-4" />
        <select name="purpose" defaultValue={purpose ?? ""} aria-label={t.fields.purposeField} className="field">
          <option value="">{a.anyPurpose}</option>
          {PURPOSES.map((v) => (
            <option key={v} value={v}>
              {t.purposeBadge[v]}
            </option>
          ))}
        </select>
        <select name="listing" defaultValue={listing ?? ""} aria-label={t.fields.listingType} className="field">
          <option value="">{t.properties.anyListing}</option>
          {LISTING_TYPES.map((v) => (
            <option key={v} value={v}>
              {t.listing[v]}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={statusParam} aria-label={c.status} className="field">
          <option value="">{a.anyStatus}</option>
          {PROPERTY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t.status[s]}
            </option>
          ))}
          <option value="inactive">{a.nav.inactive}</option>
        </select>
        <select name="type" defaultValue={type ?? ""} aria-label={t.fields.propertyType} className="field">
          <option value="">{t.properties.anyType}</option>
          {PROPERTY_TYPES.map((v) => (
            <option key={v} value={v}>
              {t.type[v]}
            </option>
          ))}
        </select>
        <select name="location" defaultValue={location ?? ""} aria-label={t.fields.location} className="field">
          <option value="">{t.properties.anyLocation}</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {locationLabel(t, l)} {l.archived && a.locations.hiddenTag}
            </option>
          ))}
        </select>
        <select name="compound" defaultValue={compound} aria-label={t.fields.compound} className="field">
          <option value="">{t.properties.anyCompound}</option>
          {compounds.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select name="seller" defaultValue={seller ?? ""} aria-label={t.fields.sellerType} className="field">
          <option value="">{a.anySeller}</option>
          {SELLER_TYPES.map((v) => (
            <option key={v} value={v}>
              {t.seller[v]}
            </option>
          ))}
        </select>
        <div className="col-span-2 flex gap-2">
          <button type="submit" className="btn-primary">
            {t.search}
          </button>
          {filtered && (
            <Link href="/admin/properties" className="btn-outline">
              {t.clear}
            </Link>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="mt-5">
          <EmptyState>{a.noMatch}</EmptyState>
        </div>
      ) : (
        <div className="card mt-5 overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-line bg-ivory text-xs uppercase tracking-wide text-cocoa">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-3 text-start font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((p) => (
                <tr key={p.id} className="align-top hover:bg-ivory/60">
                  <td className="px-3 py-3">{p.code ? <CopyCode code={p.code} /> : <span className="text-cocoa">{t.none}</span>}</td>
                  <td className="min-w-48 px-3 py-3">
                    <Link href={`/admin/properties/${p.id}`} className="font-semibold hover:text-gold-deep hover:underline">
                      {p.title}
                    </Link>
                    {p.featured && <span className="mt-1 block text-xs font-semibold text-gold-deep">{a.onHomePage}</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">{t.type[p.type]}</td>
                  <td className="whitespace-nowrap px-3 py-3">{p.purpose === "rent" ? t.purposeBadge.rent : t.listing[p.listingType]}</td>
                  <td className="whitespace-nowrap px-3 py-3">{p.compound || t.none}</td>
                  <td className="whitespace-nowrap px-3 py-3">{localName(t, p.locationName)}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-semibold">{priceText(t, p)}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {sellerName(t, p.seller)}
                    <span className="block text-xs text-cocoa">
                      {t.seller[p.seller.type]} · <span dir="ltr">{p.seller.phone}</span>
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-cocoa">{formatDay(p.createdAt, t.locale)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-cocoa">{formatDay(p.updatedAt, t.locale)}</td>
                  <td className="px-3 py-3">
                    <div className="flex min-w-56 flex-wrap gap-2">
                      <Link href={`/admin/properties/${p.id}`} className="btn-outline btn-sm whitespace-nowrap">
                        {a.viewEdit}
                      </Link>
                      <StatusActions property={p} />
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
