import Link from "next/link";
import { AreaIcon, BathIcon, BedIcon, PhotoIcon, PinIcon } from "@/components/icons";
import { cairoToday } from "@/lib/availability";
import { fmt, getDict, type Dict } from "@/lib/i18n";
import { placeParts } from "@/lib/locations";
import { priceLabel, type Pricing } from "@/lib/pricing";
import type { ListingType, Property } from "@/lib/types";
import { rangeText } from "@/lib/unit-ranges";

// Photos can be bundled files or uploads stored as URLs, so a plain <img> is used.
export function Photo({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" className={`object-cover ${className}`} />;
}

export function ListingBadge({ type, label, className = "" }: { type: ListingType; label: string; className?: string }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${type === "primary" ? "bg-espresso text-gold-light" : "bg-gold text-espresso"} ${className}`}
    >
      {label}
    </span>
  );
}

/** "5,000 EGP / night" for rentals ("From 3,000 EGP / night" when the price changes by date), plain price for sale. */
export function priceText(t: Dict, p: Pricing) {
  return priceLabel(t, p, cairoToday());
}

export function PurposeBadge({ t, p, className = "" }: { t: Dict; p: Pick<Property, "purpose" | "listingType">; className?: string }) {
  return p.purpose === "rent" ? (
    <span className={`rounded-full bg-gold px-3 py-1 text-xs font-semibold text-espresso ${className}`}>{t.purposeBadge.rent}</span>
  ) : (
    <ListingBadge type={p.listingType} label={t.listing[p.listingType]} className={className} />
  );
}

/** "Compound, Sub-location, Location" (docs/sub-locations.md). */
export function placeLabel(t: Dict, p: Pick<Property, "compound" | "locationName" | "subLocationName" | "subLocationCustom">) {
  return placeParts(t, p).join(t.locale === "ar" ? "، " : ", ");
}

export function Facts({ t, p, className = "" }: { t: Dict; p: Property; className?: string }) {
  return (
    <ul className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-cocoa ${className}`}>
      <li className="flex items-center gap-1.5">
        <BedIcon /> {fmt(t.beds, { n: rangeText(p.bedrooms, p.bedroomsMax) })}
      </li>
      <li className="flex items-center gap-1.5">
        <BathIcon /> {fmt(t.baths, { n: rangeText(p.bathrooms, p.bathroomsMax) })}
      </li>
      <li className="flex items-center gap-1.5">
        <AreaIcon /> {fmt(t.sqm, { n: rangeText(p.area, p.areaMax) })}
      </li>
    </ul>
  );
}

// Public card: must only ever show public fields (never seller details).
export async function PropertyCard({ property }: { property: Property }) {
  const t = await getDict();
  const href = `/properties/${property.code}`;
  return (
    <article className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-espresso/10">
      <Link href={href} className="relative block aspect-[4/3] overflow-hidden bg-line">
        <Photo src={property.photos[0]} alt={property.title} className="h-full w-full transition-transform duration-500 group-hover:scale-105" />
        <PurposeBadge t={t} p={property} className="absolute start-3 top-3 shadow" />
        <span className="absolute bottom-3 end-3 flex items-center gap-1 rounded-full bg-espresso/70 px-2.5 py-1 text-xs font-medium text-cream backdrop-blur">
          <PhotoIcon /> {property.photos.length}
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-lg font-extrabold text-espresso">{priceText(t, property)}</p>
        <h3 className="font-semibold leading-snug">
          <Link href={href} className="hover:text-gold-deep">
            {property.title}
          </Link>
        </h3>
        <p className="flex items-center gap-1.5 text-sm text-cocoa">
          <PinIcon /> {placeLabel(t, property)}
        </p>
        <Facts t={t} p={property} />
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3">
          <span className="text-xs text-cocoa">
            {t.type[property.type]} · <span className="font-mono" dir="auto">{property.code}</span>
          </span>
          <Link href={`${href}#request`} className="btn-primary btn-sm">
            {t.filters.requestDetails}
          </Link>
        </div>
      </div>
    </article>
  );
}
