import { describe, expect, it } from "vitest";
import { makeLocation, makeProperty } from "@/test/fixtures";
import { applySearch, featuredFirst, groupProjects, locationStats, parseSearch, placeLinks, popularLocationSearches, SEARCH_TABS, searchHref, searchTab, sortHrefs } from "./search";

const newCairo = makeLocation();
const giza = makeLocation({ id: "giza", nameEn: "Giza", nameAr: "الجيزة" });
const gizaName = { en: "Giza", ar: "الجيزة" };

describe("parseSearch locations", () => {
  it("reads one or many location ids", () => {
    expect(parseSearch({ location: "giza" }).locations).toEqual(["giza"]);
    expect(parseSearch({ location: ["giza", "new-cairo"] }).locations).toEqual(["giza", "new-cairo"]);
  });

  it("drops malformed and duplicate values", () => {
    expect(parseSearch({ location: ["giza", "giza", "New Cairo", "<script>", ""] }).locations).toEqual(["giza"]);
  });

  it("round-trips through searchHref", () => {
    const href = searchHref(parseSearch({}), { locations: ["giza", "new-cairo"] });
    expect(href).toBe("/properties?location=giza&location=new-cairo");
    const params = Object.fromEntries([["location", new URLSearchParams(href.split("?")[1]).getAll("location")]]);
    expect(parseSearch(params).locations).toEqual(["giza", "new-cairo"]);
  });
});

describe("search-bar tabs and listing types", () => {
  it("offers Primary, Resale and Rent, with no Buy tab", () => {
    expect(SEARCH_TABS).toEqual(["primary", "resale", "rent"]);
  });

  it("picks no tab by default, so a plain search covers every sale listing", () => {
    const query = parseSearch({ q: "SKY-RES-0001" });
    expect(searchTab(query)).toBeUndefined();
    expect(query).toMatchObject({ purpose: "sale", listing: undefined });
  });

  it("round-trips every tab through the search URL", () => {
    for (const tab of SEARCH_TABS) expect(searchTab(parseSearch({ tab }))).toBe(tab);
  });

  it("searches primary listings from the tab and from links", () => {
    expect(parseSearch({ tab: "primary" }).listing).toBe("primary");
    expect(parseSearch({ listing: "primary" }).listing).toBe("primary");
    expect(searchHref(parseSearch({}), { listing: "primary" })).toBe("/properties?listing=primary");
  });

  it("still opens old premium links as primary", () => {
    expect(parseSearch({ listing: "premium" }).listing).toBe("primary");
    expect(parseSearch({ tab: "premium" }).listing).toBe("primary");
  });

  it("ignores the listing type on rentals and an old 'all' tab", () => {
    expect(parseSearch({ tab: "rent", listing: "primary" })).toMatchObject({ purpose: "rent", listing: undefined });
    expect(parseSearch({ tab: "all" }).listing).toBeUndefined();
  });

  it("filters results to the chosen listing type", () => {
    const primary = makeProperty({ id: "a", listingType: "primary" });
    const resale = makeProperty({ id: "b", listingType: "resale" });
    expect(applySearch([primary, resale], parseSearch({ tab: "primary" }))).toEqual([primary]);
    expect(applySearch([primary, resale], parseSearch({ tab: "resale" }))).toEqual([resale]);
  });
});

describe("applySearch", () => {
  const inCairo = makeProperty({ id: "a" });
  const inGiza = makeProperty({ id: "b", location: "giza", locationName: gizaName });

  it("filters by location id", () => {
    expect(applySearch([inCairo, inGiza], parseSearch({ location: "giza" }))).toEqual([inGiza]);
  });

  it("matches unknown location ids to nothing", () => {
    expect(applySearch([inCairo, inGiza], parseSearch({ location: "atlantis" }))).toEqual([]);
  });

  it("finds properties by location name in either language", () => {
    expect(applySearch([inCairo, inGiza], parseSearch({ q: "giza" }))).toEqual([inGiza]);
    expect(applySearch([inCairo, inGiza], parseSearch({ q: "الجيزة" }))).toEqual([inGiza]);
  });

  it("finds Primary listings by their developer description", () => {
    const byDeveloper = makeProperty({ id: "c", listingType: "primary", developerDescription: "Built by Sample Developments since 2008." });
    expect(applySearch([inCairo, byDeveloper], parseSearch({ q: "sample developments" }))).toEqual([byDeveloper]);
  });

  it("still searches properties cached before the developer description existed", () => {
    const old: Partial<typeof inCairo> = { ...inCairo, description: "Quiet street" };
    delete old.developerDescription;
    expect(applySearch([old as typeof inCairo], parseSearch({ q: "quiet" }))).toEqual([old]);
  });
});

describe("locationStats", () => {
  it("returns one entry per given location, in order, with market figures", () => {
    const published = [
      makeProperty({ id: "a", price: 2_000_000, area: 100 }),
      makeProperty({ id: "b", price: 4_000_000, area: 100 }),
    ];
    const stats = locationStats(published, [giza, newCairo]);
    expect(stats.map((s) => s.location.id)).toEqual(["giza", "new-cairo"]);
    expect(stats[0]).toMatchObject({ count: 0, avgSqm: 0, minPrice: 0, maxPrice: 0 });
    expect(stats[1]).toMatchObject({ count: 2, avgSqm: 30_000, minPrice: 2_000_000, maxPrice: 4_000_000 });
  });
});

describe("popularLocationSearches", () => {
  it("ranks locations by listings and pairs each with its most listed type", () => {
    const published = [
      makeProperty({ id: "a", type: "villa" }),
      makeProperty({ id: "b", type: "villa" }),
      makeProperty({ id: "c", type: "apartment" }),
      makeProperty({ id: "d", location: "giza", locationName: gizaName, type: "chalet" }),
    ];
    const popular = popularLocationSearches(published, [giza, newCairo]);
    expect(popular.map((p) => [p.location.id, p.type, p.count])).toEqual([
      ["new-cairo", "villa", 3],
      ["giza", "chalet", 1],
    ]);
  });

  it("skips empty locations and respects the limit", () => {
    const published = [makeProperty({ id: "a" })];
    expect(popularLocationSearches(published, [giza, newCairo], 1).map((p) => p.location.id)).toEqual(["new-cairo"]);
    expect(popularLocationSearches([], [giza, newCairo])).toEqual([]);
  });
});

describe("groupProjects", () => {
  it("carries the location id and names onto the project", () => {
    const [project] = groupProjects([makeProperty({ compound: "Palm Hills", location: "giza", locationName: gizaName })]);
    expect(project.location).toBe("giza");
    expect(project.locationName).toEqual(gizaName);
  });

  it("labels a project primary when at least half its listings are primary", () => {
    const [half] = groupProjects([makeProperty({ id: "a", compound: "Half", listingType: "primary" }), makeProperty({ id: "b", compound: "Half" })]);
    const [mostlyResale] = groupProjects([
      makeProperty({ id: "c", compound: "Resale", listingType: "primary" }),
      makeProperty({ id: "d", compound: "Resale" }),
      makeProperty({ id: "e", compound: "Resale" }),
    ]);
    expect(half.listingType).toBe("primary");
    expect(mostlyResale.listingType).toBe("resale");
  });

  it("puts projects with a featured property first, then the biggest", () => {
    const projects = groupProjects([
      makeProperty({ id: "a1", compound: "Big" }),
      makeProperty({ id: "a2", compound: "Big" }),
      makeProperty({ id: "a3", compound: "Big" }),
      makeProperty({ id: "b1", compound: "Small" }),
      makeProperty({ id: "c1", compound: "Pinned", featured: true }),
      makeProperty({ id: "c2", compound: "Pinned" }),
    ]);
    expect(projects.map((p) => [p.compound, p.featured])).toEqual([
      ["Pinned", true],
      ["Big", false],
      ["Small", false],
    ]);
  });
});

describe("featuredFirst", () => {
  it("moves featured items to the front and keeps the order otherwise", () => {
    const items = ["new", "pinned-old", "mid", "pinned-older"].map((id) => makeProperty({ id, featured: id.startsWith("pinned") }));
    expect(featuredFirst(items).map((p) => p.id)).toEqual(["pinned-old", "pinned-older", "new", "mid"]);
    expect(items[0].id).toBe("new");
  });
});

describe("sortHrefs", () => {
  it("gives a URL per sort order, keeping filters and resetting the page", () => {
    const query = parseSearch({ q: "villa", location: "giza", beds: "3", feature: "Private pool", page: "4" });
    const hrefs = sortHrefs(query);
    expect(Object.keys(hrefs)).toEqual(["newest", "price_asc", "price_desc", "area_desc"]);
    const params = new URL(hrefs.price_asc, "http://x").searchParams;
    expect(params.get("sort")).toBe("price_asc");
    expect(params.get("q")).toBe("villa");
    expect(params.get("location")).toBe("giza");
    expect(params.get("beds")).toBe("3");
    expect(params.get("feature")).toBe("Private pool");
    expect(params.has("page")).toBe(false);
  });

  it("drops the sort param for the default order", () => {
    expect(sortHrefs(parseSearch({ sort: "price_desc", purpose: "rent" })).newest).toBe("/properties?purpose=rent");
  });
});

describe("placeLinks", () => {
  it("links the location to its search, keeping the purpose", () => {
    const { location } = placeLinks(makeProperty({ purpose: "rent", location: "giza", compound: "" }));
    const params = new URL(location, "http://x").searchParams;
    expect(params.get("location")).toBe("giza");
    expect(params.get("purpose")).toBe("rent");
  });

  it("links the compound to its project page", () => {
    expect(placeLinks(makeProperty({ compound: "Palm Hills" })).project).toBe("/projects/palm-hills");
  });

  it("has no project link when there is no compound", () => {
    expect(placeLinks(makeProperty({ compound: "" })).project).toBeNull();
    expect(placeLinks(makeProperty({ compound: "   " })).project).toBeNull();
  });
});
