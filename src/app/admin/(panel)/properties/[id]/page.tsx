import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { LeadStatusBadge, StatusActions, StatusBadge } from "@/components/admin-ui";
import { CopyCode } from "@/components/copy-button";
import { EditPropertyForm } from "@/components/edit-property-form";
import { DocumentIcon } from "@/components/icons";
import { Photo, PurposeBadge, placeLabel, priceText } from "@/components/property-card";
import { requestChanges } from "@/lib/actions";
import { floorText, formatDate, telHref, whatsappHref } from "@/lib/format";
import { fmt, getDict } from "@/lib/i18n";
import { sellerName, sellerWithType } from "@/lib/sellers";
import { selectableLocations } from "@/lib/locations";
import { getLeads, getLocations, getProperty } from "@/lib/store";

function Field({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div>
      <dt className="inline text-cocoa">{label}: </dt>
      <dd className="inline font-medium" dir={ltr ? "ltr" : undefined}>
        {value}
      </dd>
    </div>
  );
}

export default async function AdminPropertyPage({ params }: PageProps<"/admin/properties/[id]">) {
  const [t, property, locations] = await Promise.all([getDict(), getProperty((await params).id), getLocations()]);
  if (!property) notFound();
  const a = t.admin;

  const { seller } = property;
  const leads = (await getLeads()).filter((l) => l.propertyId === property.id);
  const canRequestChanges = property.status === "pending" || property.status === "needs_changes";

  const history = [
    [a.currentStatus, t.status[property.status]],
    [a.previousStatus, property.previousStatus ? t.status[property.previousStatus] : t.none],
    [a.submittedBy, sellerWithType(t, seller)],
    [a.created, formatDate(property.createdAt, t.locale)],
    [a.lastUpdated, formatDate(property.updatedAt, t.locale)],
  ];

  return (
    <div className="space-y-6">
      <Link href="/admin/properties" className="text-sm font-medium text-cocoa hover:text-gold-deep">
        {t.dir === "rtl" ? "→" : "←"} {a.allProperties}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={property.status} />
            <PurposeBadge t={t} p={property} />
            {property.featured && <span className="text-xs font-semibold text-gold-deep">{a.onHomePage}</span>}
            {property.code ? <CopyCode code={property.code} /> : <span className="text-xs text-cocoa">{a.codeOnApproval}</span>}
          </div>
          <h1 className="mt-2 text-2xl font-bold">{property.title}</h1>
          <p className="text-sm text-cocoa">
            {t.type[property.type]} · {placeLabel(t, property)} · {fmt(t.beds, { n: property.bedrooms })} ·{" "}
            {fmt(t.baths, { n: property.bathrooms })} · {fmt(t.sqm, { n: property.area })}
            {property.floor != null && <> · {floorText(t, property.floor)}</>}
          </p>
          <p className="mt-1 text-xl font-extrabold text-gold-deep">{priceText(t, property)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {property.status === "published" && (
            <a
              href={`${process.env.PUBLIC_SITE_URL ?? ""}/properties/${property.code}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline btn-sm"
            >
              {a.viewPublic}
            </a>
          )}
          <StatusActions property={property} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {property.photos.map((src, i) => (
          <a key={i} href={src} target="_blank" rel="noopener noreferrer">
            <Photo src={src} alt={fmt(t.photoAlt, { n: i + 1 })} className="aspect-square w-full rounded-xl bg-line" />
          </a>
        ))}
      </div>

      {(property.documents.length > 0 || property.listingType === "primary") && (
        <section className="card p-5">
          <h2 className="font-bold">{a.documents}</h2>
          <p className="text-xs text-cocoa">{a.documentsPrivate}</p>
          {property.documents.length === 0 ? (
            <p className="mt-3 text-sm text-cocoa">{a.noDocuments}</p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {property.documents.map((d) => (
                <li key={d.kind}>
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-line bg-ivory p-3 hover:border-gold">
                    <DocumentIcon className="h-8 w-8 text-gold-deep" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{t.documentKind[d.kind]}</span>
                      <span className="block truncate text-xs text-cocoa" dir="auto">
                        {d.name}
                      </span>
                    </span>
                    <span className="text-sm font-medium text-gold-deep">{a.openDocument}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5">
          <h2 className="font-bold">{a.sellerInfo}</h2>
          <p className="text-xs text-cocoa">{a.sellerPrivate}</p>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Field label={a.sellerType} value={t.seller[seller.type]} />
            <Field label={a.sellerName} value={sellerName(t, seller)} />
            {seller.company && <Field label={a.sellerCompany} value={seller.company} />}
            <Field label={a.phone} value={seller.phone} ltr />
            <Field label={a.whatsapp} value={seller.whatsapp || t.none} ltr />
          </dl>
          <div className="mt-4 flex gap-2">
            <a href={telHref(seller.phone)} className="btn-primary btn-sm">
              📞 {t.call}
            </a>
            <a href={whatsappHref(seller.whatsapp || seller.phone)} target="_blank" rel="noopener noreferrer" className="btn btn-sm bg-success text-deep hover:bg-success-dark">
              {t.whatsapp}
            </a>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="font-bold">{a.statusHistory}</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            {history.map(([label, value]) => (
              <Field key={label} label={label} value={value} />
            ))}
          </dl>
          {property.adminNotes && (
            <p className="mt-3 whitespace-pre-line rounded-lg bg-violet-50 p-3 text-sm text-violet-900">
              <span className="font-semibold">{a.internalNotes}: </span>
              <span dir="auto">{property.adminNotes}</span>
            </p>
          )}
        </section>

        <section className="card p-5">
          <h2 className="font-bold">{a.requestChanges}</h2>
          {canRequestChanges ? (
            <ActionForm action={requestChanges.bind(null, property.id)} className="mt-3 space-y-3">
              <textarea name="adminNotes" rows={3} maxLength={2000} defaultValue={property.adminNotes} placeholder={a.requestChangesPlaceholder} aria-label={a.internalNotes} className="field" />
              <button type="submit" className="btn-outline btn-sm">
                {a.markNeedsChanges}
              </button>
            </ActionForm>
          ) : (
            <p className="mt-3 text-sm text-cocoa">{a.requestChangesHint}</p>
          )}
        </section>
      </div>

      <section className="card p-5">
        <h2 className="font-bold">{fmt(a.propertyLeads, { count: leads.length })}</h2>
        {leads.length === 0 ? (
          <p className="mt-2 text-sm text-cocoa">{a.noLeadsForProperty}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line text-sm">
            {leads.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/admin/leads?q=${encodeURIComponent(l.phone)}`} className="font-medium hover:text-gold-deep hover:underline">
                  {l.name} · <span dir="ltr">{l.phone}</span>
                </Link>
                <span className="flex items-center gap-3 text-cocoa">
                  {formatDate(l.createdAt, t.locale)} <LeadStatusBadge status={l.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5 sm:p-8">
        <h2 className="mb-6 text-xl font-bold">{a.editProperty}</h2>
        <EditPropertyForm property={property} locations={selectableLocations(locations, property.location)} />
      </section>
    </div>
  );
}
