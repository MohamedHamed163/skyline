import Link from "next/link";
import { BuildingIcon, CheckIcon } from "@/components/icons";
import { ProjectCard } from "@/components/project-card";
import { Photo, PropertyCard } from "@/components/property-card";
import { SearchBar } from "@/components/search-bar";
import { formatPrice } from "@/lib/format";
import { fmt, getDict } from "@/lib/i18n";
import { DEFAULT_LOCATION_COVER, locationLabel } from "@/lib/locations";
import { featuredFirst, groupProjects, locationStats, popularLocationSearches, searchHref, parseSearch } from "@/lib/search";
import { getActiveLocations, getPublishedProperties } from "@/lib/store";

export default async function HomePage() {
  const [t, all, locations] = await Promise.all([getDict(), getPublishedProperties(), getActiveLocations()]);
  const h = t.home;
  const published = all.filter((p) => p.purpose === "sale");
  // Admin-featured listings lead each row (docs/homepage.md).
  const rentals = featuredFirst(all.filter((p) => p.purpose === "rent"));
  const projects = groupProjects(published).slice(0, 4);
  const allStats = locationStats(published, locations);
  const stats = allStats.filter((s) => s.count > 0);
  const maxSqm = Math.max(1, ...stats.map((s) => s.avgSqm));
  const empty = parseSearch({});
  const popular = [
    { label: t.listing.primary, href: searchHref(empty, { listing: "primary" }) },
    ...popularLocationSearches(published, locations).map(({ location, type }) => ({
      label: `${t.type[type]} · ${locationLabel(t, location)}`,
      href: searchHref(empty, { types: [type], locations: [location.id] }),
    })),
    { label: fmt(t.finder.priceUpTo, { price: formatPrice(5_000_000, t.currency) }), href: searchHref(empty, { maxPrice: 5_000_000 }) },
    { label: t.home.rentEyebrow, href: searchHref(empty, { purpose: "rent" }) },
  ];

  return (
    <>
      {/* Hero with search */}
      <section className="relative isolate overflow-hidden bg-espresso text-cream">
        <Photo src="/listings/villa-2.jpg" alt="" className="absolute inset-0 -z-10 h-full w-full opacity-35" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-deep/70 via-espresso/70 to-espresso" />
        <div className="container-page pb-28 pt-16 text-center sm:pt-24">
          <p className="eyebrow-light">{h.eyebrow}</p>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">{h.heroTitle}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-cream/80">{h.heroSub}</p>
        </div>
      </section>
      <div className="container-page relative z-10 -mt-16">
        <div className="card p-4 shadow-2xl shadow-espresso/20 sm:p-5">
          <SearchBar />
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-cocoa">{h.popular}:</span>
            {popular.map((p) => (
              <Link key={p.href} href={p.href} className="rounded-full border border-line px-3 py-1 font-medium hover:border-gold hover:text-gold-deep">
                {p.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Featured projects */}
      {projects.length > 0 && (
        <section className="container-page pt-16">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <div>
              <p className="eyebrow">{h.projectsEyebrow}</p>
              <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{h.projectsTitle}</h2>
              <p className="mt-1 text-cocoa">{h.projectsSub}</p>
            </div>
            <Link href="/projects" className="shrink-0 text-sm font-semibold text-gold-deep hover:underline">
              {h.allProjects} {t.dir === "rtl" ? "←" : "→"}
            </Link>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {projects.map((p) => (
              <ProjectCard key={p.slug} t={t} project={p} />
            ))}
          </div>
        </section>
      )}

      {/* Primary / resale rows */}
      {(["primary", "resale"] as const).map((listing) => {
        const items = featuredFirst(published.filter((p) => p.listingType === listing)).slice(0, 3);
        if (!items.length) return null;
        return (
          <section key={listing} className="container-page pt-16">
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
              <div>
                <p className="eyebrow">{listing === "primary" ? h.primaryEyebrow : h.resaleEyebrow}</p>
                <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{listing === "primary" ? h.primaryTitle : h.resaleTitle}</h2>
              </div>
              <Link href={searchHref(empty, { listing })} className="shrink-0 text-sm font-semibold text-gold-deep hover:underline">
                {h.viewAll} {t.dir === "rtl" ? "←" : "→"}
              </Link>
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => (
                <PropertyCard key={p.id} property={p} />
              ))}
            </div>
          </section>
        );
      })}
      {published.length === 0 && rentals.length === 0 && (
        <section className="container-page pt-16">
          <p className="card p-8 text-center text-cocoa">{h.empty}</p>
        </section>
      )}

      {/* Rentals (admin-managed) */}
      {rentals.length > 0 && (
        <section className="container-page pt-16">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <div>
              <p className="eyebrow">{h.rentEyebrow}</p>
              <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{h.rentTitle}</h2>
              <p className="mt-1 text-cocoa">{h.rentSub}</p>
            </div>
            <Link href={searchHref(empty, { purpose: "rent" })} className="shrink-0 text-sm font-semibold text-gold-deep hover:underline">
              {h.viewAll} {t.dir === "rtl" ? "←" : "→"}
            </Link>
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rentals.slice(0, 3).map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        </section>
      )}

      {/* Browse by location (with market figures) */}
      <section className="container-page pt-16">
        <p className="eyebrow">{h.locEyebrow}</p>
        <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{h.locTitle}</h2>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {allStats.map((s) => (
            <Link key={s.location.id} href={searchHref(empty, { locations: [s.location.id] })} className="group relative isolate flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-2xl p-4 text-cream sm:p-5">
              <Photo src={s.location.cover || DEFAULT_LOCATION_COVER} alt="" className="absolute inset-0 -z-10 h-full w-full transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 -z-10 bg-gradient-to-t from-deep/90 to-transparent" />
              <p className="text-lg font-bold sm:text-xl">{locationLabel(t, s.location)}</p>
              <p className="text-sm text-cream/80">{fmt(h.available, { count: s.count })}</p>
              {s.avgSqm > 0 && <p className="text-xs font-semibold text-gold-light">{fmt(t.filters.avgSqm, { price: formatPrice(s.avgSqm, t.currency) })}</p>}
            </Link>
          ))}
        </div>
      </section>

      {/* Market snapshot */}
      {stats.length > 0 && (
        <section className="container-page pt-16">
          <div className="card overflow-hidden">
            <div className="grid lg:grid-cols-[1fr_1.4fr]">
              <div className="bg-espresso p-6 text-cream sm:p-8">
                <p className="eyebrow-light">{h.marketEyebrow}</p>
                <h2 className="mt-2 text-2xl font-bold">{h.marketTitle}</h2>
                <p className="mt-2 text-sm text-cream/75">{h.marketSub}</p>
                <dl className="mt-8 grid grid-cols-2 gap-6">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-cream/60">{t.market.listings}</dt>
                    <dd className="mt-1 text-3xl font-extrabold text-gold-light">{published.length}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-cream/60">{t.market.avgSqm}</dt>
                    <dd className="mt-1 text-3xl font-extrabold text-gold-light">{formatPrice(Math.round(stats.reduce((a, s) => a + s.avgSqm * s.count, 0) / published.length), t.currency)}</dd>
                  </div>
                </dl>
              </div>
              <div className="p-6 sm:p-8">
                <p className="mb-4 text-sm font-semibold">{t.market.avgSqm}</p>
                <ul className="space-y-3">
                  {stats.map((s) => (
                    <li key={s.location.id}>
                      <div className="flex items-center justify-between text-sm">
                        <Link href={searchHref(empty, { locations: [s.location.id] })} className="font-medium hover:text-gold-deep">
                          {locationLabel(t, s.location)}
                        </Link>
                        <span className="text-cocoa">
                          <span className="font-semibold text-espresso">{formatPrice(s.avgSqm, t.currency)}</span> {t.market.perSqm} · {s.count}
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-ivory">
                        <div className="h-full rounded-full bg-gold" style={{ width: `${Math.max(6, (s.avgSqm / maxSqm) * 100)}%` }} />
                      </div>
                      <p className="mt-0.5 text-xs text-cocoa">
                        {t.market.range}: {formatPrice(s.minPrice, t.currency)} – {formatPrice(s.maxPrice, t.currency)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Why Skyline + CTA */}
      <section className="container-page py-16">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="eyebrow">{h.whyEyebrow}</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{h.whyTitle}</h2>
            <ul className="mt-6 space-y-4">
              {h.why.map(([title, body]) => (
                <li key={title} className="flex gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold-deep">
                    <CheckIcon />
                  </span>
                  <div>
                    <p className="font-semibold">{title}</p>
                    <p className="text-sm text-cocoa">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link href="/properties" className="btn-primary mt-8">
              {h.browseBtn}
            </Link>
          </div>
          <div className="rounded-2xl bg-espresso p-6 text-cream sm:p-8">
            <BuildingIcon className="h-8 w-8 text-gold" />
            <p className="eyebrow-light mt-4">{h.sellerEyebrow}</p>
            <h2 className="mt-2 text-2xl font-bold">{h.sellerTitle}</h2>
            <ol className="mt-6 space-y-4">
              {h.sellerSteps.map(([title, body], i) => (
                <li key={title} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-bold text-espresso">{i + 1}</span>
                  <div>
                    <p className="font-semibold">{title}</p>
                    <p className="text-sm text-cream/70">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link href="/submit" className="btn-primary mt-8">
              {h.listBtn}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
