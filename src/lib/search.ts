import { FEATURES, LISTING_TYPES, PROPERTY_TYPES, RENT_PERIODS, type ListingType, type Location, type LocationName, type Property, type PropertyType, type Purpose, type RentPeriod } from "./types";

// Public search: parses URL params, filters/sorts published properties, paginates,
// and derives the market and project summaries shown on the site.

export const SORTS = ["newest", "price_asc", "price_desc", "area_desc"] as const;
export type Sort = (typeof SORTS)[number];
export const PER_PAGE = 12;

export type SearchQuery = {
  q: string;
  /** "sale" (default) or "rent" — the two sides of the site. */
  purpose: Purpose;
  period?: RentPeriod;
  listing?: ListingType;
  types: PropertyType[];
  /** Location ids. Unknown ids simply match nothing. */
  locations: string[];
  compound: string;
  beds: number;
  baths: number;
  minPrice: number;
  maxPrice: number;
  minArea: number;
  maxArea: number;
  features: string[];
  sort: Sort;
  page: number;
};

type Params = Record<string, string | string[] | undefined>;
const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const num = (v: string | string[] | undefined) => Math.max(0, Number(one(v)) || 0);
const LOCATION_ID = /^[a-z0-9-]{1,60}$/;

export function parseSearch(params: Params): SearchQuery {
  // The search bar posts a single "tab" (all | premium | resale | rent); links use purpose/listing directly.
  const tab = one(params.tab);
  const rent = tab === "rent" || one(params.purpose) === "rent";
  return {
    q: one(params.q).trim().slice(0, 80),
    purpose: rent ? "rent" : "sale",
    period: rent ? RENT_PERIODS.find((v) => v === one(params.period)) : undefined,
    listing: rent ? undefined : LISTING_TYPES.find((v) => v === (tab === "premium" || tab === "resale" ? tab : one(params.listing))),
    types: PROPERTY_TYPES.filter((v) => list(params.type).includes(v)),
    locations: [...new Set(list(params.location).filter((v) => LOCATION_ID.test(v)))].slice(0, 20),
    compound: one(params.compound).trim().slice(0, 80),
    beds: num(params.beds),
    baths: num(params.baths),
    minPrice: num(params.min),
    maxPrice: num(params.max),
    minArea: num(params.minArea),
    maxArea: num(params.maxArea),
    features: (FEATURES as readonly string[]).filter((f) => list(params.feature).includes(f)),
    sort: SORTS.find((s) => s === one(params.sort)) ?? "newest",
    page: Math.max(1, Math.floor(num(params.page)) || 1),
  };
}

export function isFiltered(s: SearchQuery) {
  return Boolean(
    s.q || s.listing || s.period || s.types.length || s.locations.length || s.compound || s.beds || s.baths ||
      s.minPrice || s.maxPrice || s.minArea || s.maxArea || s.features.length,
  );
}

/** Builds a /properties URL from a query, with optional overrides (page resets unless given). */
export function searchHref(s: SearchQuery, overrides: Partial<SearchQuery> = {}) {
  const m = { ...s, page: 1, ...overrides };
  const p = new URLSearchParams();
  if (m.purpose === "rent") p.set("purpose", "rent");
  if (m.purpose === "rent" && m.period) p.set("period", m.period);
  if (m.q) p.set("q", m.q);
  if (m.listing) p.set("listing", m.listing);
  m.types.forEach((v) => p.append("type", v));
  m.locations.forEach((v) => p.append("location", v));
  if (m.compound) p.set("compound", m.compound);
  if (m.beds) p.set("beds", String(m.beds));
  if (m.baths) p.set("baths", String(m.baths));
  if (m.minPrice) p.set("min", String(m.minPrice));
  if (m.maxPrice) p.set("max", String(m.maxPrice));
  if (m.minArea) p.set("minArea", String(m.minArea));
  if (m.maxArea) p.set("maxArea", String(m.maxArea));
  m.features.forEach((v) => p.append("feature", v));
  if (m.sort !== "newest") p.set("sort", m.sort);
  if (m.page > 1) p.set("page", String(m.page));
  const qs = p.toString();
  return qs ? `/properties?${qs}` : "/properties";
}

/** The /properties URL for each sort order, keeping the current filters (page resets to 1). */
export function sortHrefs(s: SearchQuery): Record<Sort, string> {
  return Object.fromEntries(SORTS.map((sort) => [sort, searchHref(s, { sort })])) as Record<Sort, string>;
}

export function applySearch(properties: Property[], s: SearchQuery) {
  const q = s.q.toLowerCase();
  const out = properties.filter(
    (p) =>
      (!q || [p.title, p.compound, p.code, p.locationName.en, p.locationName.ar, p.description].join(" ").toLowerCase().includes(q)) &&
      p.purpose === s.purpose &&
      (!s.period || p.rentPeriod === s.period) &&
      (!s.listing || p.listingType === s.listing) &&
      (!s.types.length || s.types.includes(p.type)) &&
      (!s.locations.length || s.locations.includes(p.location)) &&
      (!s.compound || p.compound === s.compound) &&
      (!s.beds || p.bedrooms >= s.beds) &&
      (!s.baths || p.bathrooms >= s.baths) &&
      (!s.minPrice || p.price >= s.minPrice) &&
      (!s.maxPrice || p.price <= s.maxPrice) &&
      (!s.minArea || p.area >= s.minArea) &&
      (!s.maxArea || p.area <= s.maxArea) &&
      s.features.every((f) => p.features.includes(f)),
  );
  const by: Record<Sort, (a: Property, b: Property) => number> = {
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    price_asc: (a, b) => a.price - b.price,
    price_desc: (a, b) => b.price - a.price,
    area_desc: (a, b) => b.area - a.area,
  };
  return out.sort(by[s.sort]);
}

export function paginate<T>(items: T[], page: number, perPage = PER_PAGE) {
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const current = Math.min(page, pages);
  const start = (current - 1) * perPage;
  return { items: items.slice(start, start + perPage), page: current, pages, from: items.length ? start + 1 : 0, to: Math.min(start + perPage, items.length), total: items.length };
}

// ---- Market data ----

export const avgPricePerSqm = (items: Property[]) =>
  items.length ? Math.round(items.reduce((sum, p) => sum + p.price / p.area, 0) / items.length) : 0;

/** Market figures per location, in the order of `locations` (pass the active ones). */
export function locationStats(published: Property[], locations: Location[]) {
  return locations.map((location) => {
    const items = published.filter((p) => p.location === location.id);
    const prices = items.map((p) => p.price);
    return {
      location,
      count: items.length,
      avgSqm: avgPricePerSqm(items),
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
    };
  });
}

/**
 * Home-page "popular searches": the busiest locations, each paired with its most listed type.
 * Derived from live data so it follows whatever locations the admin manages.
 */
export function popularLocationSearches(published: Property[], locations: Location[], limit = 3) {
  return locations
    .map((location) => {
      const items = published.filter((p) => p.location === location.id);
      const counts = new Map<PropertyType, number>();
      for (const p of items) counts.set(p.type, (counts.get(p.type) ?? 0) + 1);
      const type = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      return { location, type, count: items.length };
    })
    .filter((x): x is { location: Location; type: PropertyType; count: number } => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ---- Projects (properties grouped by compound) ----

export type Project = {
  compound: string;
  slug: string;
  location: string;
  locationName: LocationName;
  listingType: ListingType;
  properties: Property[];
  cover: string;
  minPrice: number;
  maxPrice: number;
  types: PropertyType[];
};

export const projectSlug = (compound: string) => encodeURIComponent(compound.trim().toLowerCase().replace(/\s+/g, "-"));

export function groupProjects(published: Property[]): Project[] {
  const map = new Map<string, Property[]>();
  for (const p of published) {
    if (!p.compound) continue;
    map.set(p.compound, [...(map.get(p.compound) ?? []), p]);
  }
  return [...map.entries()]
    .map(([compound, properties]) => {
      const premium = properties.filter((p) => p.listingType === "premium").length;
      return {
        compound,
        slug: projectSlug(compound),
        location: properties[0].location,
        locationName: properties[0].locationName,
        listingType: premium * 2 >= properties.length ? "premium" : "resale",
        properties,
        cover: properties[0].photos[0],
        minPrice: Math.min(...properties.map((p) => p.price)),
        maxPrice: Math.max(...properties.map((p) => p.price)),
        types: [...new Set(properties.map((p) => p.type))],
      } satisfies Project;
    })
    .sort((a, b) => b.properties.length - a.properties.length);
}

/** Properties that are close to the given one: same compound first, then same location & type. */
export function similarTo(property: Property, published: Property[], limit = 3) {
  const others = published.filter((p) => p.id !== property.id && p.purpose === property.purpose);
  const score = (p: Property) =>
    (p.compound && p.compound === property.compound ? 4 : 0) +
    (p.location === property.location ? 2 : 0) +
    (p.type === property.type ? 1 : 0) +
    (p.listingType === property.listingType ? 1 : 0);
  return others
    .map((p) => ({ p, s: score(p) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.p);
}

/**
 * Where a property's location details link to: the search for its location, and its project page
 * when it is in a compound (`project` is null otherwise, so the page can hide that row).
 */
export function placeLinks(property: Pick<Property, "purpose" | "location" | "compound">) {
  const compound = property.compound.trim();
  return {
    location: searchHref(parseSearch({}), { purpose: property.purpose, locations: [property.location] }),
    project: compound ? `/projects/${projectSlug(compound)}` : null,
  };
}
