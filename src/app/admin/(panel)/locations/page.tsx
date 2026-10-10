import { EmptyState } from "@/components/admin-ui";
import { LocationArchiveButton, LocationForm } from "@/components/location-admin";
import { Photo } from "@/components/property-card";
import { getDict } from "@/lib/i18n";
import { DEFAULT_LOCATION_COVER } from "@/lib/locations";
import { getLocations, getProperties } from "@/lib/store";

// Admin: add, rename, re-photo, hide and restore the locations used across the site.
export default async function AdminLocationsPage() {
  const [t, locations, properties] = await Promise.all([getDict(), getLocations(), getProperties()]);
  const l = t.admin.locations;
  const counts = new Map<string, number>();
  for (const p of properties) counts.set(p.location, (counts.get(p.location) ?? 0) + 1);
  // Active first, then hidden; each alphabetical (getLocations order).
  const sorted = [...locations].sort((a, b) => Number(a.archived) - Number(b.archived));

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold">{l.title}</h1>
      <p className="mt-1 text-sm text-cocoa">{l.intro}</p>

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
            </article>
          );
        })}
      </div>
    </div>
  );
}
