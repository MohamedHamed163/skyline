import { describe, expect, it } from "vitest";
import { makeLocation, makeProperty } from "@/test/fixtures";
import { applySearch, groupProjects, locationStats, parseSearch, popularLocationSearches, searchHref, sortHrefs } from "./search";

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
