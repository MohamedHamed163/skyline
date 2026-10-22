import { cairoToday, type Day } from "./availability";
import { listPrice } from "./pricing";
import { upper } from "./unit-ranges";
import { FEATURES, LISTING_TYPES, PROPERTY_TYPES, toListingType, type ListingType, type Location, type LocationName, type Property, type PropertyType, type Purpose } from "./types";

// Public search: parses URL params, filters/sorts published properties, paginates,
// and derives the market and project summaries shown on the site.

export const SORTS = ["newest", "price_asc", "price_desc", "area_desc"] as const;
export type Sort = (typeof SORTS)[number];
export const PER_PAGE = 12;

/**
 * The home search-bar tabs. There is no "Buy" tab and none is picked by default, so a plain
 * search covers every sale listing; picking a tab narrows it (docs/listing-types.md).
 */
export const SEARCH_TABS = [...LISTING_TYPES, "rent"] as const;
export type SearchTab = (typeof SEARCH_TABS)[number];

export type SearchQuery = {
  q: string;
  /** "sale" (default) or "rent" — the two sides of the site. */
  purpose: Purpose;
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
  // The search bar posts a single "tab" (primary | resale | rent); links use purpose/listing directly.
  const tab = one(params.tab);
  const rent = tab === "rent" || one(params.purpose) === "rent";
  return {
    q: one(params.q).trim().slice(0, 80),
    purpose: rent ? "rent" : "sale",
    listing: rent ? undefined : (toListingType(tab) ?? toListingType(one(params.listing))),
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

/** The search-bar tab that matches a query, or undefined when it covers every sale listing. */
export function searchTab(q: Partial<Pick<SearchQuery, "purpose" | "listing">>): SearchTab | undefined {
  return q.purpose === "rent" ? "rent" : q.listing;
}

export function isFiltered(s: SearchQuery) {
  return Boolean(
    s.q || s.listing || s.types.length || s.locations.length || s.compound || s.beds || s.baths ||
      s.minPrice || s.maxPrice || s.minArea || s.maxArea || s.features.length,
  );
}

/** Builds a /properties URL from a query, with optional overrides (page resets unless given). */
export function searchHref(s: SearchQuery, overrides: Partial<SearchQuery> = {}) {
  const m = { ...s, page: 1, ...overrides };
  const p = new URLSearchParams();
  if (m.purpose === "rent") p.set("purpose", "rent");
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

/**
 * Filters and sorts published properties. Rentals whose price changes by date are filtered and
 * sorted by their "From" price, the lowest from `today` on (docs/rental-pricing.md). A Primary
 * listing given as ranges matches when any of its units could: its range overlaps the filter
 * (docs/unit-ranges.md). Low-to-high sorts use the bottom of each range, high-to-low ones the top.
 */
export function applySearch(properties: Property[], s: SearchQuery, today: Day = cairoToday()) {
  const q = s.q.toLowerCase();
  const prices = new Map(properties.map((p) => [p, listPrice(p, today)]));
  const price = (p: Property) => prices.get(p) ?? p.price;
  const topPrice = (p: Property) => p.priceMax ?? price(p);
  const out = properties.filter(
    (p) =>
      (!q || [p.title, p.compound, p.code, p.locationName.en, p.locationName.ar, p.description, p.developerDescription].join(" ").toLowerCase().includes(q)) &&
      p.purpose === s.purpose &&
      (!s.listing || p.listingType === s.listing) &&
      (!s.types.length || s.types.includes(p.type)) &&
      (!s.locations.length || s.locations.includes(p.location)) &&
      (!s.compound || p.compound === s.compound) &&
      (!s.beds || upper(p, "bedrooms") >= s.beds) &&
      (!s.baths || upper(p, "bathrooms") >= s.baths) &&
      (!s.minPrice || topPrice(p) >= s.minPrice) &&
      (!s.maxPrice || price(p) <= s.maxPrice) &&
      (!s.minArea || upper(p, "area") >= s.minArea) &&
      (!s.maxArea || p.area <= s.maxArea) &&
      s.features.every((f) => p.features.includes(f)),
  );
  const by: Record<Sort, (a: Property, b: Property) => number> = {
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    price_asc: (a, b) => price(a) - price(b),
    price_desc: (a, b) => topPrice(b) - topPrice(a),
    area_desc: (a, b) => upper(b, "area") - upper(a, "area"),
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
    const prices = items.flatMap((p) => [p.price, upper(p, "price")]);
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
  /** At least one of its properties is shown on the home page by the admin. */
  featured: boolean;
  properties: Property[];
  cover: string;
  minPrice: number;
  maxPrice: number;
  types: PropertyType[];
};

export const projectSlug = (compound: string) => encodeURIComponent(compound.trim().toLowerCase().replace(/\s+/g, "-"));

/** Admin-featured items first; otherwise keeps the incoming order (newest first for properties). */
export const featuredFirst = <T extends { featured: boolean }>(items: T[]): T[] =>
  [...items].sort((a, b) => Number(b.featured) - Number(a.featured));

/** Compounds as projects: featured ones first, then the ones with the most listings. */
export function groupProjects(published: Property[]): Project[] {
  const map = new Map<string, Property[]>();
  for (const p of published) {
    if (!p.compound) continue;
    map.set(p.compound, [...(map.get(p.compound) ?? []), p]);
  }
  return [...map.entries()]
    .map(([compound, properties]) => {
      const primary = properties.filter((p) => p.listingType === "primary").length;
      return {
        compound,
        slug: projectSlug(compound),
        location: properties[0].location,
        locationName: properties[0].locationName,
        listingType: primary * 2 >= properties.length ? "primary" : "resale",
        featured: properties.some((p) => p.featured),
        properties,
        cover: properties[0].photos[0],
        minPrice: Math.min(...properties.map((p) => p.price)),
        maxPrice: Math.max(...properties.map((p) => upper(p, "price"))),
        types: [...new Set(properties.map((p) => p.type))],
      } satisfies Project;
    })
    .sort((a, b) => Number(b.featured) - Number(a.featured) || b.properties.length - a.properties.length);
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
