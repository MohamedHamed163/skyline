import type { Metadata } from "next";
import Link from "next/link";
import { ActiveFilters, Filters } from "@/components/filters";
import { PropertyCard } from "@/components/property-card";
import { SearchBar } from "@/components/search-bar";
import { SortSelect } from "@/components/sort-select";
import { formatPrice } from "@/lib/format";
import { fmt, getDict } from "@/lib/i18n";
import { applySearch, avgPricePerSqm, isFiltered, paginate, parseSearch, searchHref, sortHrefs, SORTS, type Sort } from "@/lib/search";
import { locationLabel } from "@/lib/locations";
import { getLocations, getPublishedProperties } from "@/lib/store";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).properties.metaTitle };
}

export default async function PropertiesPage({ searchParams }: PageProps<"/properties">) {
  const [t, params, published, locations] = await Promise.all([getDict(), searchParams, getPublishedProperties(), getLocations()]);
  const f = t.filters;
  const query = parseSearch(params);
  const results = applySearch(published, query);
  const page = paginate(results, query.page);
  const compounds = [...new Set(published.map((p) => p.compound).filter(Boolean))].sort();
  const sortLabels: Record<Sort, string> = { newest: f.sortNewest, price_asc: f.sortPriceAsc, price_desc: f.sortPriceDesc, area_desc: f.sortAreaDesc };
  const onlyLocation = query.locations.length === 1 ? locations.find((l) => l.id === query.locations[0]) : undefined;
  const heading = query.purpose === "rent" ? t.properties.titleRent : query.listing ? fmt(t.properties.titleListing, { listing: t.listing[query.listing] }) : onlyLocation ? locationLabel(t, onlyLocation) : t.properties.titleAll;

  return (
    <div className="container-page py-8">
      <div className="card p-3 sm:p-4">
        <SearchBar query={query} compact />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[18rem_1fr]">
        <aside>
          <Filters query={query} compounds={compounds} />
        </aside>

        <section className="group/results min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">{heading}</h1>
              <p className="mt-1 text-sm text-cocoa">
                {fmt(f.results, { count: results.length })}
                {results.length > 0 && <> · {fmt(f.avgSqm, { price: formatPrice(avgPricePerSqm(results), t.currency) })}</>}
              </p>
            </div>
            <SortSelect label={f.sort} value={query.sort} options={SORTS.map((s) => ({ value: s, label: sortLabels[s] }))} hrefs={sortHrefs(query)} />
          </div>

          {isFiltered(query) && (
            <div className="mt-4">
              <ActiveFilters query={query} />
            </div>
          )}

          {page.items.length > 0 ? (
            <>
              <div className="mt-6 grid gap-6 transition-opacity sm:grid-cols-2 xl:grid-cols-3 group-has-data-pending/results:pointer-events-none group-has-data-pending/results:opacity-50">
                {page.items.map((p) => (
                  <PropertyCard key={p.id} property={p} />
                ))}
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm text-cocoa">
                <span>{fmt(f.showing, { from: page.from, to: page.to, count: page.total })}</span>
                {page.pages > 1 && (
                  <nav className="flex items-center gap-2">
                    {page.page > 1 && (
                      <Link href={searchHref(query, { page: page.page - 1 })} className="btn-outline btn-sm">
                        {f.prev}
                      </Link>
                    )}
                    <span>{fmt(f.pageOf, { page: page.page, pages: page.pages })}</span>
                    {page.page < page.pages && (
                      <Link href={searchHref(query, { page: page.page + 1 })} className="btn-outline btn-sm">
                        {f.next}
                      </Link>
                    )}
                  </nav>
                )}
              </div>
            </>
          ) : (
            <div className="card mt-6 p-10 text-center">
              <p className="font-semibold">{f.noResults}</p>
              <p className="mt-1 text-sm text-cocoa">{f.noResultsHint}</p>
              <Link href={query.purpose === "rent" ? "/properties?purpose=rent" : "/properties"} className="btn-outline mt-4">
                {f.clearAll}
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
