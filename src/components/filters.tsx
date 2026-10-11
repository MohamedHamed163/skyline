import Link from "next/link";
import { CloseIcon } from "@/components/icons";
import { formatPrice } from "@/lib/format";
import { fmt, getDict } from "@/lib/i18n";
import { locationLabel } from "@/lib/locations";
import { searchHref, type SearchQuery } from "@/lib/search";
import { getActiveLocations, getLocations } from "@/lib/store";
import { FEATURES, LISTING_TYPES, PROPERTY_TYPES, RENT_PERIODS } from "@/lib/types";

function Chips<T extends string | number>({ name, options, selected, labels, multiple }: { name: string; options: T[]; selected: T[]; labels: (v: T) => string; multiple?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((v) => (
        <label key={String(v)}>
          <input type={multiple ? "checkbox" : "radio"} name={name} value={String(v)} defaultChecked={selected.includes(v)} className="peer sr-only" />
          <span className="block cursor-pointer rounded-full border border-line bg-white px-3 py-1.5 text-sm transition peer-checked:border-espresso peer-checked:bg-espresso peer-checked:text-cream hover:border-gold">
            {labels(v)}
          </span>
        </label>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line pt-4">
      <p className="mb-2.5 text-sm font-semibold">{title}</p>
      {children}
    </div>
  );
}

// Bayut-style filter sidebar. Plain GET form; collapsible on small screens.
export async function Filters({ query, compounds }: { query: SearchQuery; compounds: string[] }) {
  const [t, locations] = await Promise.all([getDict(), getActiveLocations()]);
  const f = t.filters;
  const plus = (n: number) => fmt(f.plus, { n });

  const form = (
    <form action="/properties" className="mt-4 space-y-4">
      {query.q && <input type="hidden" name="q" value={query.q} />}
        {query.sort !== "newest" && <input type="hidden" name="sort" value={query.sort} />}

        <Section title={f.buyRent}>
          <Chips name="purpose" options={["sale", "rent"]} selected={[query.purpose]} labels={(v) => t.purpose[v as "sale" | "rent"]} />
        </Section>

        {query.purpose === "rent" ? (
          <Section title={f.period}>
            <Chips name="period" options={["", ...RENT_PERIODS] as string[]} selected={[query.period ?? ""]} labels={(v) => (v ? t.rentPeriod[v as "night" | "month"] : f.any)} />
          </Section>
        ) : (
          <Section title={f.purpose}>
            <Chips name="listing" options={["", ...LISTING_TYPES] as string[]} selected={[query.listing ?? ""]} labels={(v) => (v ? t.listing[v as "primary" | "resale"] : f.all)} />
          </Section>
        )}

        <Section title={f.location}>
          <div className="space-y-1.5">
            {locations.map((l) => (
              <label key={l.id} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" name="location" value={l.id} defaultChecked={query.locations.includes(l.id)} className="h-4 w-4 accent-gold" />
                {locationLabel(t, l)}
              </label>
            ))}
          </div>
        </Section>

        <Section title={f.type}>
          <Chips name="type" options={[...PROPERTY_TYPES]} selected={query.types} labels={(v) => t.type[v]} multiple />
        </Section>

        <Section title={f.bedrooms}>
          <Chips name="beds" options={[0, 1, 2, 3, 4, 5]} selected={[query.beds]} labels={(v) => (v ? plus(v) : f.any)} />
        </Section>

        <Section title={f.bathrooms}>
          <Chips name="baths" options={[0, 1, 2, 3, 4]} selected={[query.baths]} labels={(v) => (v ? plus(v) : f.any)} />
        </Section>

        <Section title={fmt(f.price, { currency: t.currency })}>
          <div className="grid grid-cols-2 gap-2">
            <input name="min" type="number" min={0} step={100000} defaultValue={query.minPrice || ""} placeholder={f.min} aria-label={f.min} className="field" />
            <input name="max" type="number" min={0} step={100000} defaultValue={query.maxPrice || ""} placeholder={f.max} aria-label={f.max} className="field" />
          </div>
        </Section>

        <Section title={f.area}>
          <div className="grid grid-cols-2 gap-2">
            <input name="minArea" type="number" min={0} defaultValue={query.minArea || ""} placeholder={f.min} aria-label={f.min} className="field" />
            <input name="maxArea" type="number" min={0} defaultValue={query.maxArea || ""} placeholder={f.max} aria-label={f.max} className="field" />
          </div>
        </Section>

        {compounds.length > 0 && (
          <Section title={f.compound}>
            <select name="compound" defaultValue={query.compound} aria-label={f.compound} className="field">
              <option value="">{f.any}</option>
              {compounds.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Section>
        )}

        <Section title={f.features}>
          <div className="grid grid-cols-2 gap-1.5">
            {FEATURES.map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" name="feature" value={v} defaultChecked={query.features.includes(v)} className="h-4 w-4 accent-gold" />
                {t.feature[v]}
              </label>
            ))}
          </div>
        </Section>

        <div className="flex gap-2 border-t border-line pt-4">
          <button type="submit" className="btn-primary flex-1">
            {f.apply}
          </button>
          <Link href="/properties" className="btn-outline">
            {f.reset}
          </Link>
        </div>
    </form>
  );

  return (
    <>
      {/* Phones: collapsed by default. Desktop: always visible. */}
      <details className="card p-4 lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between font-bold">
          {f.title}
          <span className="text-xs font-medium text-cocoa">{f.showFilters}</span>
        </summary>
        {form}
      </details>
      <div className="card hidden p-4 lg:sticky lg:top-24 lg:block">
        <p className="font-bold">{f.title}</p>
        {form}
      </div>
    </>
  );
}

/** Removable chips summarising the active filters (Bayut-style). */
export async function ActiveFilters({ query }: { query: SearchQuery }) {
  const [t, locations] = await Promise.all([getDict(), getLocations()]);
  const f = t.filters;
  const chips: { label: string; href: string }[] = [];
  if (query.q) chips.push({ label: `“${query.q}”`, href: searchHref(query, { q: "" }) });
  if (query.listing) chips.push({ label: t.listing[query.listing], href: searchHref(query, { listing: undefined }) });
  if (query.period) chips.push({ label: `${f.period} ${t.rentPeriod[query.period]}`, href: searchHref(query, { period: undefined }) });
  query.locations.forEach((v) => {
    const l = locations.find((x) => x.id === v);
    if (l) chips.push({ label: locationLabel(t, l), href: searchHref(query, { locations: query.locations.filter((x) => x !== v) }) });
  });
  query.types.forEach((v) => chips.push({ label: t.type[v], href: searchHref(query, { types: query.types.filter((x) => x !== v) }) }));
  if (query.compound) chips.push({ label: query.compound, href: searchHref(query, { compound: "" }) });
  if (query.beds) chips.push({ label: `${fmt(t.filters.plus, { n: query.beds })} ${t.filters.bedrooms}`, href: searchHref(query, { beds: 0 }) });
  if (query.baths) chips.push({ label: `${fmt(t.filters.plus, { n: query.baths })} ${t.filters.bathrooms}`, href: searchHref(query, { baths: 0 }) });
  if (query.minPrice) chips.push({ label: fmt(t.finder.priceFrom, { price: formatPrice(query.minPrice, t.currency) }), href: searchHref(query, { minPrice: 0 }) });
  if (query.maxPrice) chips.push({ label: fmt(t.finder.priceUpTo, { price: formatPrice(query.maxPrice, t.currency) }), href: searchHref(query, { maxPrice: 0 }) });
  if (query.minArea) chips.push({ label: `${t.filters.min} ${fmt(t.sqm, { n: query.minArea })}`, href: searchHref(query, { minArea: 0 }) });
  if (query.maxArea) chips.push({ label: `${t.filters.max} ${fmt(t.sqm, { n: query.maxArea })}`, href: searchHref(query, { maxArea: 0 }) });
  query.features.forEach((v) => chips.push({ label: t.feature[v as keyof typeof t.feature], href: searchHref(query, { features: query.features.filter((x) => x !== v) }) }));
  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {chips.map((c) => (
        <Link key={c.label + c.href} href={c.href} className="flex items-center gap-1 rounded-full bg-espresso px-3 py-1 text-xs font-medium text-cream hover:bg-deep">
          {c.label} <CloseIcon className="h-3 w-3" />
        </Link>
      ))}
      <Link href={query.purpose === "rent" ? "/properties?purpose=rent" : "/properties"} className="text-xs font-semibold text-gold-deep hover:underline">
        {t.filters.clearAll}
      </Link>
    </div>
  );
}
