import { SearchIcon } from "@/components/icons";
import { formatPrice } from "@/lib/format";
import { fmt, getDict } from "@/lib/i18n";
import { locationLabel } from "@/lib/locations";
import { SEARCH_TABS, searchTab, type SearchQuery } from "@/lib/search";
import { getActiveLocations } from "@/lib/store";
import { PROPERTY_TYPES } from "@/lib/types";

const PRICE_STEPS = [2_000_000, 5_000_000, 10_000_000, 20_000_000, 50_000_000];

// Property-Finder-style search bar (plain GET form, works without JS).
export async function SearchBar({ query, compact = false }: { query?: Partial<SearchQuery>; compact?: boolean }) {
  const [t, locations] = await Promise.all([getDict(), getActiveLocations()]);
  const f = t.finder;
  const q = query ?? {};
  const tab = searchTab(q);

  return (
    <form action="/properties" className={compact ? "flex flex-col gap-2 lg:flex-row" : "space-y-3"}>
      {compact && q.purpose === "rent" && <input type="hidden" name="purpose" value="rent" />}
      {compact && q.listing && <input type="hidden" name="listing" value={q.listing} />}
      {/* Primary | Resale | Rent. None is picked until the visitor chooses, so a plain search covers all sale listings. */}
      {!compact && (
        <div className="flex gap-1 rounded-xl bg-ivory p-1">
          {SEARCH_TABS.map((v) => (
            <label key={v} className="flex-1">
              <input type="radio" name="tab" value={v} defaultChecked={tab === v} className="peer sr-only" />
              <span className="block cursor-pointer rounded-lg px-3 py-2 text-center text-sm font-semibold text-cocoa transition hover:text-espresso peer-checked:bg-espresso peer-checked:text-cream peer-focus-visible:ring-2 peer-focus-visible:ring-gold">
                {v === "rent" ? t.purpose.rent : t.listing[v]}
              </span>
            </label>
          ))}
        </div>
      )}
      <div className={`grid gap-2 ${compact ? "flex-1 grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]" : "grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]"}`}>
        <label className="relative col-span-2 md:col-span-1 lg:col-span-1">
          <SearchIcon className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-cocoa" />
          <input name="q" defaultValue={q.q} placeholder={f.placeholder} aria-label={t.search} className="field ps-9" />
        </label>
        <select name="location" defaultValue={q.locations?.[0] ?? ""} aria-label={t.filters.location} className="field">
          <option value="">{f.anyLocation}</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {locationLabel(t, l)}
            </option>
          ))}
        </select>
        <select name="type" defaultValue={q.types?.[0] ?? ""} aria-label={t.filters.type} className="field">
          <option value="">{f.anyType}</option>
          {PROPERTY_TYPES.map((v) => (
            <option key={v} value={v}>
              {t.type[v]}
            </option>
          ))}
        </select>
        <select name="beds" defaultValue={q.beds || ""} aria-label={t.filters.bedrooms} className="field">
          <option value="">{f.anyBeds}</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {fmt(t.filters.plus, { n })} {t.filters.bedrooms.toLowerCase()}
            </option>
          ))}
        </select>
        <select name="max" defaultValue={q.maxPrice || ""} aria-label={t.filters.price} className="field">
          <option value="">{f.anyPrice}</option>
          {PRICE_STEPS.map((n) => (
            <option key={n} value={n}>
              {fmt(f.priceUpTo, { price: formatPrice(n, t.currency) })}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-primary col-span-2 md:col-span-1 lg:col-span-1">
          <SearchIcon /> {f.button}
        </button>
      </div>
    </form>
  );
}
