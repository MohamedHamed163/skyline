import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EditStatus, HostCode, HostStatus } from "@/components/account-ui";
import { Photo, PurposeBadge, placeLabel, priceText } from "@/components/property-card";
import { descriptionSections } from "@/lib/descriptions";
import { floorText } from "@/lib/format";
import { canHostEdit } from "@/lib/host-accounts";
import { ownListing } from "@/lib/host-auth";
import { fmt, getDict } from "@/lib/i18n";
import { sellerName } from "@/lib/sellers";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).account.metaTitle, robots: { index: false } };
}

// A host's own listing as Skyline has it, in any status (docs/host-accounts.md). Includes their
// private contact details, which the public property page never shows. It shows the live values: a
// waiting edit is only described (docs/host-edit-approval.md) and can be opened with "Edit your changes".
export default async function HostListingPage({ params }: PageProps<"/account/listings/[id]">) {
  const [t, { host, property: p }] = await Promise.all([getDict(), ownListing((await params).id)]);
  if (!host) redirect("/account");
  if (!p) notFound();
  const a = t.account;
  const editable = canHostEdit(p);
  const sections = descriptionSections(p);
  const sectionTitle = { overview: t.property.description, project: t.property.aboutProject, developer: t.property.aboutDeveloper };
  const contact = [
    [t.fields.sellerType, t.seller[p.seller.type]],
    [t.fields.sellerName, sellerName(t, p.seller)],
    ...(p.seller.company ? [[t.fields.company, p.seller.company]] : []),
    [t.fields.phone, p.seller.phone],
    [t.fields.whatsapp, p.seller.whatsapp || t.none],
  ];

  return (
    <section className="container-page space-y-6 py-10">
      <Link href="/account" className="text-sm font-medium text-cocoa hover:text-gold-deep">
        {t.dir === "rtl" ? "→" : "←"} {a.back}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <HostStatus t={t} p={p} />
            <PurposeBadge t={t} p={p} />
            <HostCode t={t} p={p} />
          </div>
          <h1 className="mt-2 text-2xl font-bold">{p.title}</h1>
          <p className="text-sm text-cocoa">
            {t.type[p.type]} · {placeLabel(t, p)} · {fmt(t.beds, { n: p.bedrooms })} · {fmt(t.baths, { n: p.bathrooms })} · {fmt(t.sqm, { n: p.area })}
            {p.floor != null && <> · {floorText(t, p.floor)}</>}
          </p>
          <p className="mt-1 text-xl font-extrabold text-gold-deep">{priceText(t, p)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {p.status === "published" && p.code && (
            <Link href={`/properties/${p.code}`} className="btn-outline">
              {a.onWebsite}
            </Link>
          )}
          {editable && (
            <Link href={`/account/listings/${p.id}/edit`} className="btn-primary">
              {p.pendingEdit ? a.editChanges : a.edit}
            </Link>
          )}
        </div>
      </div>

      <div className="space-y-2" role="status">
        <p className="rounded-xl bg-ivory px-4 py-3 text-sm">
          {a.statusHint[p.status]} {!editable && a.locked}
        </p>
        <EditStatus t={t} p={p} />
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {p.photos.map((src, i) => (
          <a key={i} href={src} target="_blank" rel="noopener noreferrer">
            <Photo src={src} alt={fmt(t.photoAlt, { n: i + 1 })} className="aspect-square w-full rounded-xl bg-line" />
          </a>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {sections.map((s) => (
            <section key={s.kind} className="card p-5">
              <h2 className="font-bold">{sectionTitle[s.kind]}</h2>
              <p className="mt-2 whitespace-pre-line text-sm text-cocoa" dir="auto">
                {s.text}
              </p>
            </section>
          ))}
          {p.features.length > 0 && (
            <section className="card p-5">
              <h2 className="font-bold">{t.property.features}</h2>
              <ul className="mt-3 flex flex-wrap gap-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="rounded-full bg-ivory px-3 py-1">
                    {t.feature[f as keyof typeof t.feature] ?? f}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <section className="card p-5">
          <h2 className="font-bold">{a.yourDetails}</h2>
          <p className="text-xs text-cocoa">{a.detailsPrivate}</p>
          <dl className="mt-3 space-y-1.5 text-sm">
            {contact.map(([label, value]) => (
              <div key={label}>
                <dt className="inline text-cocoa">{label}: </dt>
                <dd className="inline font-medium" dir="auto">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </section>
  );
}
