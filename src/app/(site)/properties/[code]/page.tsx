import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Gallery } from "@/components/gallery";
import { AreaIcon, BathIcon, BedIcon, BuildingIcon, CheckIcon, PhoneIcon, PinIcon, WhatsAppIcon } from "@/components/icons";
import { LeadForm } from "@/components/lead-form";
import { PropertyCard, PurposeBadge, placeLabel, priceText } from "@/components/property-card";
import { ShareButton } from "@/components/share-button";
import { formatDay, formatPrice, telHref, whatsappHref } from "@/lib/format";
import { fmt, getDict } from "@/lib/i18n";
import { localName } from "@/lib/locations";
import { avgPricePerSqm, projectSlug, searchHref, parseSearch, similarTo } from "@/lib/search";
import { getPublishedProperties, getPublishedProperty } from "@/lib/store";

// Only published properties are public. Seller details are never rendered here.
async function publishedProperty(params: Promise<{ code: string }>) {
  return getPublishedProperty((await params).code.toUpperCase());
}

export async function generateMetadata({ params }: PageProps<"/properties/[code]">): Promise<Metadata> {
  const [t, property] = await Promise.all([getDict(), publishedProperty(params)]);
  return { title: property ? `${property.title} (${property.code})` : t.property.notFound };
}

export default async function PropertyPage({ params }: PageProps<"/properties/[code]">) {
  const [t, property, published] = await Promise.all([getDict(), publishedProperty(params), getPublishedProperties()]);
  if (!property) notFound();
  const p = t.property;
  const similar = similarTo(property, published);
  const sameCompound = property.compound ? published.filter((x) => x.compound === property.compound && x.id !== property.id && x.purpose === property.purpose) : [];
  // English name for the map search, whatever the UI language.
  const place = property.compound ? `${property.compound}, ${property.locationName.en}` : property.locationName.en;
  const skylinePhone = process.env.NEXT_PUBLIC_SKYLINE_PHONE;
  const skylineWhatsapp = process.env.NEXT_PUBLIC_SKYLINE_WHATSAPP;

  const facts = [
    { icon: <BuildingIcon />, label: p.type, value: t.type[property.type] },
    { icon: <BedIcon />, label: p.bedrooms, value: property.bedrooms },
    { icon: <BathIcon />, label: p.bathrooms, value: property.bathrooms },
    { icon: <AreaIcon />, label: p.area, value: fmt(t.sqm, { n: property.area }) },
  ];

  return (
    <div className="container-page py-6">
      <nav className="flex flex-wrap items-center gap-1.5 text-sm text-cocoa" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-gold-deep">{p.home}</Link>
        <span>/</span>
        <Link href="/properties" className="hover:text-gold-deep">{t.nav.properties}</Link>
        <span>/</span>
        <Link href={searchHref(parseSearch({}), { purpose: property.purpose, locations: [property.location] })} className="hover:text-gold-deep">{localName(t, property.locationName)}</Link>
        {property.compound && (
          <>
            <span>/</span>
            <Link href={`/projects/${projectSlug(property.compound)}`} className="hover:text-gold-deep">{property.compound}</Link>
          </>
        )}
        <span>/</span>
        <span className="font-mono text-espresso" dir="ltr">{property.code}</span>
      </nav>

      <div className="mt-4">
        <Gallery photos={property.photos} title={property.title} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PurposeBadge t={t} p={property} />
            <span className="rounded-full border border-line bg-white px-3 py-1 font-mono text-xs font-semibold" dir="ltr">{property.code}</span>
            <span className="text-xs text-cocoa">{p.listedOn} {formatDay(property.createdAt, t.locale)}</span>
            <span className="ms-auto"><ShareButton /></span>
          </div>
          <h1 className="mt-3 text-3xl font-bold">{property.title}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-cocoa"><PinIcon /> {placeLabel(t, property)}</p>
          <p className="mt-4 text-3xl font-extrabold text-espresso">
            {priceText(t, property)}
            {property.purpose === "sale" && <span className="mt-1 block whitespace-nowrap text-sm font-medium text-cocoa sm:ms-3 sm:mt-0 sm:inline">{formatPrice(Math.round(property.price / property.area), t.currency)} {t.market.perSqm}</span>}
          </p>

          <h2 className="mt-8 text-lg font-bold">{p.keyFacts}</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {facts.map((f) => (
              <div key={f.label} className="card flex items-center gap-3 p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/15 text-gold-deep">{f.icon}</span>
                <div>
                  <dt className="text-xs text-cocoa">{f.label}</dt>
                  <dd className="font-bold">{f.value}</dd>
                </div>
              </div>
            ))}
          </dl>

          {property.description && (
            <>
              <h2 className="mt-8 text-lg font-bold">{p.overview}</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-cocoa">{property.description}</p>
            </>
          )}

          {property.features.length > 0 && (
            <>
              <h2 className="mt-8 text-lg font-bold">{p.features}</h2>
              <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                {property.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <CheckIcon className="text-success-deep" /> {t.feature[f as keyof typeof t.feature] ?? f}
                  </li>
                ))}
              </ul>
            </>
          )}

          <h2 className="mt-8 text-lg font-bold">{p.locationSection}</h2>
          <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between border-b border-line py-2">
              <dt className="text-cocoa">{p.location}</dt>
              <dd className="font-medium">{localName(t, property.locationName)}</dd>
            </div>
            <div className="flex justify-between border-b border-line py-2">
              <dt className="text-cocoa">{p.compound}</dt>
              <dd className="font-medium">{property.compound || t.none}</dd>
            </div>
          </dl>
          <div className="mt-3 overflow-hidden rounded-2xl border border-line">
            <iframe
              title={fmt(p.mapHint, { place })}
              src={`https://www.google.com/maps?q=${encodeURIComponent(`${place}, Egypt`)}&z=12&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-64 w-full"
            />
          </div>
          <p className="mt-1 text-xs text-cocoa">{fmt(p.mapHint, { place })}</p>
        </div>

        <aside>
          <div id="request" className="card sticky top-24 scroll-mt-24 p-6">
            <p className="text-2xl font-extrabold text-espresso">{priceText(t, property)}</p>
            <h2 className="mt-3 text-lg font-bold">{p.askAbout}</h2>
            <p className="mb-5 mt-1 text-sm text-cocoa">{p.advisorNote}</p>
            <LeadForm propertyId={property.id} />
            {(skylinePhone || skylineWhatsapp) && (
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4">
                {skylinePhone && (
                  <a href={telHref(skylinePhone)} className="btn-outline btn-sm"><PhoneIcon /> {p.callSkyline}</a>
                )}
                {skylineWhatsapp && (
                  <a href={whatsappHref(skylineWhatsapp, `${property.code}: ${property.title}`)} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm"><WhatsAppIcon /> {t.whatsapp}</a>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {sameCompound.length > 0 && (
        <section className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <h2 className="text-2xl font-bold">{fmt(p.moreIn, { compound: property.compound })}</h2>
            <Link href={`/projects/${projectSlug(property.compound)}`} className="text-sm font-semibold text-gold-deep hover:underline">
              {t.project.view} · {fmt(t.filters.avgSqm, { price: formatPrice(avgPricePerSqm(sameCompound), t.currency) })}
            </Link>
          </div>
          <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sameCompound.slice(0, 3).map((x) => <PropertyCard key={x.id} property={x} />)}
          </div>
        </section>
      )}

      {similar.length > 0 && (
        <section className="mt-14">
          <h2 className="text-2xl font-bold">{p.similar}</h2>
          <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((x) => <PropertyCard key={x.id} property={x} />)}
          </div>
        </section>
      )}
    </div>
  );
}
