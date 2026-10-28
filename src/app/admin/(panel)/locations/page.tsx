import { EmptyState } from "@/components/admin-ui";
import { LocationArchiveButton, LocationForm, MatchTypedForm, SubLocationArchiveButton, SubLocationForm } from "@/components/location-admin";
import { Photo } from "@/components/property-card";
import { fmt, getDict } from "@/lib/i18n";
import { customSubLocations, DEFAULT_LOCATION_COVER, locationLabel } from "@/lib/locations";
import { getLocations, getProperties } from "@/lib/store";

// Admin: add, rename, re-photo, hide and restore the locations used across the site, and their
// sub-locations (docs/sub-locations.md), including the ones sellers typed.
export default async function AdminLocationsPage() {
  const [t, locations, properties] = await Promise.all([getDict(), getLocations(), getProperties()]);
  const l = t.admin.locations;
  const counts = new Map<string, number>();
  for (const p of properties) {
    counts.set(p.location, (counts.get(p.location) ?? 0) + 1);
    if (p.subLocation) counts.set(p.subLocation, (counts.get(p.subLocation) ?? 0) + 1);
  }
  const typed = customSubLocations(properties);
  // Active first, then hidden; each alphabetical (getLocations order).
  const sorted = [...locations].sort((a, b) => Number(a.archived) - Number(b.archived));

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold">{l.title}</h1>
      <p className="mt-1 text-sm text-cocoa">{l.intro}</p>

      {typed.length > 0 && (
        <section className="card mt-6 border-gold/50 p-5 sm:p-6">
          <h2 className="font-bold">{l.typedTitle}</h2>
          <p className="mt-1 text-sm text-cocoa">{l.typedIntro}</p>
          <ul className="mt-4 divide-y divide-line">
            {typed.map((c) => {
              const loc = locations.find((x) => x.id === c.locationId);
              return (
                <li key={`${c.locationId}:${c.text}`} className="py-3">
                  <p className="font-semibold">
                    <span dir="auto">{c.text}</span> <span className="text-cocoa">·</span> {loc ? locationLabel(t, loc) : c.locationId}{" "}
                    <span className="text-xs font-normal text-cocoa">({fmt(l.typedListings, { n: c.count })})</span>
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <details>
                      <summary className="cursor-pointer text-sm font-semibold text-gold-deep">{l.addToList}</summary>
                      <div className="mt-2">
                        <SubLocationForm locationId={c.locationId} typed={c.text} />
                      </div>
                    </details>
                    {loc && loc.subLocations.length > 0 && (
                      <details>
                        <summary className="cursor-pointer text-sm font-semibold text-gold-deep">{l.matchExisting}</summary>
                        <div className="mt-2">
                          <MatchTypedForm locationId={c.locationId} typed={c.text} subs={loc.subLocations} />
                        </div>
                      </details>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="card mt-6 p-5 sm:p-6">
        <h2 className="mb-4 font-bold">{l.add}</h2>
        <LocationForm />
      </section>

      <div className="mt-6 space-y-3">
        {sorted.length === 0 && <EmptyState>{l.empty}</EmptyState>}
        {sorted.map((loc) => {
          const count = counts.get(loc.id) ?? 0;
          return (
            <article key={loc.id} className={`card p-4 ${loc.archived ? "opacity-70" : ""}`}>
              <div className="flex flex-wrap items-center gap-4">
                <Photo src={loc.cover || DEFAULT_LOCATION_COVER} alt="" className="h-14 w-20 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {loc.nameEn} <span className="text-cocoa">·</span> <span lang="ar">{loc.nameAr}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-cocoa">
                    <span className={`me-2 rounded-full px-2 py-0.5 font-semibold ${loc.archived ? "bg-line text-cocoa" : "bg-success/15 text-success-deep"}`}>
                      {loc.archived ? l.hidden : l.active}
                    </span>
                    {l.properties}: {count} · <span dir="ltr" className="font-mono">{loc.id}</span>
                  </p>
                </div>
                <LocationArchiveButton location={loc} count={count} />
              </div>
              <details className="mt-3 border-t border-line pt-3">
                <summary className="cursor-pointer text-sm font-semibold text-gold-deep">{l.edit}</summary>
                <div className="mt-3">
                  <LocationForm location={loc} />
                </div>
              </details>
              <details className="mt-3 border-t border-line pt-3">
                <summary className="cursor-pointer text-sm font-semibold text-gold-deep">{fmt(l.subLocations, { n: loc.subLocations.length })}</summary>
                <p className="mt-2 text-xs text-cocoa">{l.subLocationsHint}</p>
                <ul className="mt-3 space-y-3">
                  {loc.subLocations.map((sub) => (
                    <li key={sub.id} className={`rounded-xl border border-line p-3 ${sub.archived ? "opacity-70" : ""}`}>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-cocoa">
                        <span>
                          <span className={`me-2 rounded-full px-2 py-0.5 font-semibold ${sub.archived ? "bg-line text-cocoa" : "bg-success/15 text-success-deep"}`}>
                            {sub.archived ? l.hidden : l.active}
                          </span>
                          {l.properties}: {counts.get(sub.id) ?? 0} · <span dir="ltr" className="font-mono">{sub.id}</span>
                        </span>
                        <SubLocationArchiveButton sub={sub} count={counts.get(sub.id) ?? 0} />
                      </div>
                      <SubLocationForm locationId={loc.id} sub={sub} />
                    </li>
                  ))}
                </ul>
                <div className="mt-4">
                  <SubLocationForm locationId={loc.id} />
                </div>
              </details>
            </article>
          );
        })}
      </div>
    </div>
  );
}
