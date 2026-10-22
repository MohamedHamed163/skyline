import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AvailabilityCalendar } from "@/components/availability-calendar";
import { Gallery } from "@/components/gallery";
import { AreaIcon, BathIcon, BedIcon, BuildingIcon, CheckIcon, ChevronIcon, PhoneIcon, PinIcon, StairsIcon, WhatsAppIcon } from "@/components/icons";
import { LeadForm } from "@/components/lead-form";
import { PropertyCard, PurposeBadge, placeLabel, priceText } from "@/components/property-card";
import { ShareButton } from "@/components/share-button";
import { cairoToday } from "@/lib/availability";
import { bookingRental } from "@/lib/booking";
import { descriptionSections } from "@/lib/descriptions";
import { formatDay, formatPrice, telHref, whatsappHref } from "@/lib/format";
import { fmt, getDict } from "@/lib/i18n";
import { localName } from "@/lib/locations";
import { pricesVary } from "@/lib/pricing";
import { codeFromParam } from "@/lib/property-codes";
import { avgPricePerSqm, placeLinks, similarTo } from "@/lib/search";
import { getPublishedProperties, getPublishedProperty } from "@/lib/store";
import { isRange, rangeText } from "@/lib/unit-ranges";

// Only published properties are public. Seller details are never rendered here.
async function publishedProperty(params: Promise<{ code: string }>) {
  return getPublishedProperty(codeFromParam((await params).code));
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
  const links = placeLinks(property);
  const sameCompound = property.compound ? published.filter((x) => x.compound === property.compound && x.id !== property.id && x.purpose === property.purpose) : [];
  // English name for the map search, whatever the UI language.
  const place = property.compound ? `${property.compound}, ${property.locationName.en}` : property.locationName.en;
  const skylinePhone = process.env.NEXT_PUBLIC_SKYLINE_PHONE;
  const skylineWhatsapp = process.env.NEXT_PUBLIC_SKYLINE_WHATSAPP;
  const today = cairoToday();
  // Rentals whose price changes by date show "From …" and point to the calendar (docs/rental-pricing.md).
  const vary = property.purpose === "rent" && pricesVary(property, today);

  // Primary listings show "from – to" ranges across the project's units (docs/unit-ranges.md).
  const facts = [
    { icon: <BuildingIcon />, label: p.type, value: t.type[property.type] },
    { icon: <BedIcon />, label: p.bedrooms, value: rangeText(property.bedrooms, property.bedroomsMax) },
    { icon: <BathIcon />, label: p.bathrooms, value: rangeText(property.bathrooms, property.bathroomsMax) },
    { icon: <AreaIcon />, label: p.area, value: fmt(t.sqm, { n: rangeText(property.area, property.areaMax) }) },
    // Floor is optional, so the card only appears when it was given. `== null` also covers
    // properties cached before the field existed, which have no floor key at all.
    ...(property.floor == null
      ? []
      : [{ icon: <StairsIcon />, label: p.floor, value: rangeText(property.floor, property.floorMax, (n) => (n === 0 ? p.ground : String(n))) }]),
  ];
  // A price per m² only makes sense for a single unit, not across a range of sizes or prices.
  const perSqm = property.purpose === "sale" && !isRange(property, "area") && !isRange(property, "price");
  // Primary listings: "About the project" and "About the developer"; others: one "Overview".
  const headings = { overview: p.overview, project: p.aboutProject, developer: p.aboutDeveloper };

  return (
    <div className="container-page py-6">
      <nav className="flex flex-wrap items-center gap-1.5 text-sm text-cocoa" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-gold-deep">{p.home}</Link>
        <span>/</span>
        <Link href="/properties" className="hover:text-gold-deep">{t.nav.properties}</Link>
        <span>/</span>
        <Link href={links.location} className="hover:text-gold-deep">{localName(t, property.locationName)}</Link>
        {links.project && (
          <>
            <span>/</span>
            <Link href={links.project} className="hover:text-gold-deep">{property.compound}</Link>
          </>
        )}
        <span>/</span>
        <span className="font-mono text-espresso" dir="auto">{property.code}</span>
      </nav>

      <div className="mt-4">
        <Gallery photos={property.photos} title={property.title} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PurposeBadge t={t} p={property} />
            <span className="rounded-full border border-line bg-white px-3 py-1 font-mono text-xs font-semibold" dir="auto">{property.code}</span>
            <span className="text-xs text-cocoa">{p.listedOn} {formatDay(property.createdAt, t.locale)}</span>
            <span className="ms-auto"><ShareButton /></span>
          </div>
          <h1 className="mt-3 text-3xl font-bold">{property.title}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-cocoa"><PinIcon /> {placeLabel(t, property)}</p>
          <p className="mt-4 text-3xl font-extrabold text-espresso">
            {priceText(t, property)}
            {perSqm && <span className="mt-1 block whitespace-nowrap text-sm font-medium text-cocoa sm:ms-3 sm:mt-0 sm:inline">{formatPrice(Math.round(property.price / property.area), t.currency)} {t.market.perSqm}</span>}
          </p>
          {vary && (
            <p className="mt-1 text-sm text-cocoa">
              <a href="#availability" className="hover:text-gold-deep hover:underline">{p.pricesVary}</a>
            </p>
          )}

          <h2 className="mt-8 text-lg font-bold">{p.keyFacts}</h2>
          <dl className={`mt-3 grid grid-cols-2 gap-3 ${facts.length > 4 ? "sm:grid-cols-3 xl:grid-cols-5" : "sm:grid-cols-4"}`}>
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

          {descriptionSections(property).map((s) => (
            <section key={s.kind}>
              <h2 className="mt-8 text-lg font-bold">{headings[s.kind]}</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-cocoa">{s.text}</p>
            </section>
          ))}

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

          {property.purpose === "rent" && (
            <>
              <h2 id="availability" className="mt-8 scroll-mt-24 text-lg font-bold">{p.availability}</h2>
              <p className="mt-1 text-sm text-cocoa">{p.availabilityHint}</p>
              <div className="card mt-3 p-4 sm:p-5">
                {/* `?? []` covers rentals cached before booked days existed (docs/caching.md). Only the
                    fields the calendar needs go to the browser, never the seller's details. */}
                <AvailabilityCalendar booked={property.bookedDates ?? []} today={today} rental={bookingRental(property)} />
              </div>
            </>
          )}

          <h2 className="mt-8 text-lg font-bold">{p.locationSection}</h2>
          {/* Label above value; values link to the location search and the project page. Compound is optional, so it is hidden when empty. */}
          <dl className="mt-3 flex flex-wrap gap-x-10 gap-y-4 text-sm">
            <PlaceLink icon={<PinIcon />} label={p.location} href={links.location} value={localName(t, property.locationName)} />
            {links.project && <PlaceLink icon={<BuildingIcon />} label={p.compound} href={links.project} value={property.compound} />}
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

      {links.project && sameCompound.length > 0 && (
        <section className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <h2 className="text-2xl font-bold">{fmt(p.moreIn, { compound: property.compound })}</h2>
            <Link href={links.project} className="text-sm font-semibold text-gold-deep hover:underline">
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

function PlaceLink({ icon, label, href, value }: { icon: ReactNode; label: string; href: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/15 text-gold-deep">{icon}</span>
      <div>
        <dt className="text-xs text-cocoa">{label}</dt>
        <dd>
          <Link href={href} className="group inline-flex items-center gap-1 font-semibold text-gold-deep hover:underline underline-offset-4">
            {value}
            <ChevronIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
          </Link>
        </dd>
      </div>
    </div>
  );
}
