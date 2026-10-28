import { describe, expect, it } from "vitest";
import { makeLocation, makeProperty, makeSubLocation } from "@/test/fixtures";
import { diffEdit, pickHostEdit } from "./listing-edits";
import {
  customSubLocations,
  isArabic,
  placeParts,
  readSubLocation,
  selectableLocations,
  sortSubLocations,
  subLocationId,
  subLocationLabel,
  subLocationParent,
  typedKey,
  validateSubLocation,
} from "./locations";
import { applySearch, inPlaces, isFiltered, parseSearch, placeLinks, searchHref, subLocationCounts } from "./search";

// Sub-locations (docs/sub-locations.md), with the real names from the seed list.

const en = { locale: "en" };
const ar = { locale: "ar" };

const fifth = makeSubLocation();
const rehab = makeSubLocation({ id: "new-cairo--rehab", nameEn: "Rehab", nameAr: "الرحاب", sortOrder: 40 });
const oldArea = makeSubLocation({ id: "new-cairo--old-area", nameEn: "Old Area", nameAr: "منطقة قديمة", archived: true });
const newCairo = makeLocation({ subLocations: [fifth, rehab, oldArea] });
const marassi = makeSubLocation({ id: "north-coast--marassi", locationId: "north-coast", nameEn: "Marassi", nameAr: "مراسي" });
const lasirenaNorth = makeSubLocation({ id: "north-coast--lasirena", locationId: "north-coast", nameEn: "Lasirena", nameAr: "لاسيرينا" });
const northCoast = makeLocation({ id: "north-coast", nameEn: "North Coast", nameAr: "الساحل الشمالي", subLocations: [marassi, lasirenaNorth] });
const alexandria = makeLocation({ id: "alexandria", nameEn: "Alexandria", nameAr: "الإسكندرية" });

const ncName = { en: "North Coast", ar: "الساحل الشمالي" };

describe("sub-location ids", () => {
  it("joins the location and slug, and splits back to the location", () => {
    expect(subLocationId("new-cairo", "fifth-settlement")).toBe("new-cairo--fifth-settlement");
    expect(subLocationParent("new-cairo--fifth-settlement")).toBe("new-cairo");
  });

  it("keeps the same name apart in different locations", () => {
    expect(subLocationId("north-coast", "lasirena")).not.toBe(subLocationId("ain-sokhna", "lasirena"));
  });
});

describe("sortSubLocations", () => {
  it("orders by sort order, then English name", () => {
    const a = makeSubLocation({ id: "a", nameEn: "Zamalek", sortOrder: 1 });
    const b = makeSubLocation({ id: "b", nameEn: "Agouza", sortOrder: 2 });
    const c = makeSubLocation({ id: "c", nameEn: "Dokki", sortOrder: 2 });
    expect(sortSubLocations([c, b, a]).map((s) => s.id)).toEqual(["a", "b", "c"]);
  });
});

describe("readSubLocation", () => {
  it("is optional", () => {
    expect(readSubLocation(newCairo, "", "")).toEqual({ subLocation: null, subLocationCustom: "" });
    expect(readSubLocation(newCairo, "other", "   ")).toEqual({ subLocation: null, subLocationCustom: "" });
  });

  it("accepts one of the location's sub-locations", () => {
    expect(readSubLocation(newCairo, fifth.id, "ignored")).toEqual({ subLocation: fifth.id, subLocationCustom: "" });
  });

  it("rejects a sub-location of another location (Lasirena of the North Coast on a New Cairo listing)", () => {
    expect(readSubLocation(newCairo, lasirenaNorth.id, "")).toBeNull();
    expect(readSubLocation(northCoast, lasirenaNorth.id, "")).toEqual({ subLocation: lasirenaNorth.id, subLocationCustom: "" });
    expect(readSubLocation(newCairo, "made-up", "")).toBeNull();
  });

  it("keeps a hidden sub-location the property already has", () => {
    expect(readSubLocation(newCairo, oldArea.id, "")).toEqual({ subLocation: oldArea.id, subLocationCustom: "" });
  });

  it("keeps typed text, tidied", () => {
    expect(readSubLocation(newCairo, "other", "  Golden   Square ")).toEqual({ subLocation: null, subLocationCustom: "Golden Square" });
  });

  it("caps typed text at 60 characters", () => {
    expect(readSubLocation(newCairo, "other", "x".repeat(100))?.subLocationCustom).toHaveLength(60);
  });

  it("turns typed text that names a listed sub-location into it, in either language and any case", () => {
    expect(readSubLocation(newCairo, "other", "fifth  SETTLEMENT")).toEqual({ subLocation: fifth.id, subLocationCustom: "" });
    expect(readSubLocation(newCairo, "other", "الرحاب")).toEqual({ subLocation: rehab.id, subLocationCustom: "" });
  });

  it("takes typed text for a location without a list", () => {
    expect(readSubLocation(alexandria, "", "Smouha")).toEqual({ subLocation: null, subLocationCustom: "Smouha" });
  });
});

describe("validateSubLocation", () => {
  it("requires both names", () => {
    expect(validateSubLocation({ nameEn: "Madinaty", nameAr: "" }, newCairo.subLocations)).toBe("missing");
  });

  it("rejects a name already used in the same location, hidden ones included", () => {
    expect(validateSubLocation({ nameEn: "rehab", nameAr: "x" }, newCairo.subLocations)).toBe("duplicate");
    expect(validateSubLocation({ nameEn: "x", nameAr: "منطقة قديمة" }, newCairo.subLocations)).toBe("duplicate");
  });

  it("allows the same name in another location", () => {
    expect(validateSubLocation({ nameEn: "Lasirena", nameAr: "لاسيرينا" }, newCairo.subLocations)).toBeNull();
  });

  it("lets a sub-location keep its own name when edited", () => {
    expect(validateSubLocation({ nameEn: "Rehab", nameAr: "الرحاب" }, newCairo.subLocations, rehab.id)).toBeNull();
  });
});

describe("selectableLocations with sub-locations", () => {
  it("drops hidden sub-locations", () => {
    const [loc] = selectableLocations([newCairo]);
    expect(loc.subLocations.map((s) => s.id)).toEqual([fifth.id, rehab.id]);
  });

  it("keeps the hidden sub-location a property is already on", () => {
    const [loc] = selectableLocations([newCairo], undefined, oldArea.id);
    expect(loc.subLocations.map((s) => s.id)).toContain(oldArea.id);
  });
});

describe("placeParts and subLocationLabel", () => {
  const inFifth = makeProperty({ subLocation: fifth.id, subLocationName: { en: "Fifth Settlement", ar: "التجمع الخامس" }, compound: "Mountain View iCity" });

  it("reads compound, sub-location, location", () => {
    expect(placeParts(en, inFifth)).toEqual(["Mountain View iCity", "Fifth Settlement", "New Cairo"]);
    expect(placeParts(ar, inFifth)).toEqual(["Mountain View iCity", "التجمع الخامس", "القاهرة الجديدة"]);
  });

  it("skips empty parts", () => {
    expect(placeParts(en, makeProperty())).toEqual(["New Cairo"]);
  });

  it("shows typed text as it was typed", () => {
    const typed = makeProperty({ subLocationCustom: "Golden Square" });
    expect(subLocationLabel(ar, typed)).toBe("Golden Square");
    expect(placeParts(en, typed)).toEqual(["Golden Square", "New Cairo"]);
  });

  it("doesn't repeat a sub-location that is also the compound (Marassi, Marassi)", () => {
    const p = makeProperty({ location: "north-coast", locationName: ncName, compound: "marassi", subLocation: marassi.id, subLocationName: { en: "Marassi", ar: "مراسي" } });
    expect(placeParts(en, p)).toEqual(["marassi", "North Coast"]);
    expect(placeParts(ar, { ...p, compound: "مراسي" })).toEqual(["مراسي", "الساحل الشمالي"]);
  });

  it("reads properties cached before sub-locations existed", () => {
    const old = makeProperty();
    delete (old as Partial<typeof old>).subLocationName;
    delete (old as Partial<typeof old>).subLocationCustom;
    expect(placeParts(en, old)).toEqual(["New Cairo"]);
  });
});

describe("customSubLocations", () => {
  it("groups typed text per location regardless of case and spacing, most used first", () => {
    const rows = [
      makeProperty({ subLocationCustom: "New narges" }),
      makeProperty({ subLocationCustom: "new  Narges" }),
      makeProperty({ subLocationCustom: "Golden Square" }),
      makeProperty({ location: "north-coast", subLocationCustom: "New narges" }),
      makeProperty({ subLocation: fifth.id }),
    ];
    expect(customSubLocations(rows)).toEqual([
      { locationId: "new-cairo", text: "New narges", count: 2 },
      { locationId: "new-cairo", text: "Golden Square", count: 1 },
      { locationId: "north-coast", text: "New narges", count: 1 },
    ]);
  });

  it("uses the same key the database update matches on", () => {
    expect(typedKey("  New   NARGES ")).toBe("new narges");
  });
});

describe("isArabic", () => {
  it("tells Arabic text from English", () => {
    expect(isArabic("بورتو جولف")).toBe(true);
    expect(isArabic("Porto golf")).toBe(false);
  });
});

describe("search by sub-location", () => {
  const props = [
    makeProperty({ id: "fifth", subLocation: fifth.id, subLocationName: { en: "Fifth Settlement", ar: "التجمع الخامس" } }),
    makeProperty({ id: "rehab", subLocation: rehab.id, subLocationName: { en: "Rehab", ar: "الرحاب" } }),
    makeProperty({ id: "nc-none" }),
    makeProperty({ id: "typed", subLocationCustom: "Golden Square" }),
    makeProperty({ id: "marassi", location: "north-coast", locationName: ncName, subLocation: marassi.id }),
    makeProperty({ id: "nc-coast", location: "north-coast", locationName: ncName }),
  ];
  const ids = (params: Record<string, string | string[]>) => applySearch(props, parseSearch(params)).map((p) => p.id).sort();

  it("reads area ids from the URL and drops malformed ones", () => {
    expect(parseSearch({ area: [fifth.id, "fifth-settlement", "x--", fifth.id] }).areas).toEqual([fifth.id]);
  });

  it("round-trips through searchHref", () => {
    const q = parseSearch({ location: "new-cairo", area: fifth.id });
    expect(searchHref(q)).toBe("/properties?location=new-cairo&area=new-cairo--fifth-settlement");
    expect(isFiltered(parseSearch({ area: fifth.id }))).toBe(true);
  });

  it("matches the whole location when only the location is ticked", () => {
    expect(ids({ location: "new-cairo" })).toEqual(["fifth", "nc-none", "rehab", "typed"]);
  });

  it("narrows a location to its ticked sub-locations", () => {
    expect(ids({ location: "new-cairo", area: [fifth.id, rehab.id] })).toEqual(["fifth", "rehab"]);
  });

  it("narrows only the location the sub-location belongs to", () => {
    expect(ids({ location: ["new-cairo", "north-coast"], area: fifth.id })).toEqual(["fifth", "marassi", "nc-coast"]);
  });

  it("matches a sub-location on its own, without its location ticked", () => {
    expect(ids({ area: marassi.id })).toEqual(["marassi"]);
  });

  it("matches nothing for an unknown sub-location", () => {
    expect(ids({ area: "new-cairo--atlantis" })).toEqual([]);
  });

  it("finds sub-location names and typed text with the keyword search", () => {
    expect(ids({ q: "التجمع" })).toEqual(["fifth"]);
    expect(ids({ q: "golden" })).toEqual(["typed"]);
  });

  it("inPlaces matches everything without a place filter", () => {
    expect(inPlaces(makeProperty(), { locations: [], areas: [] })).toBe(true);
  });

  it("counts listings per sub-location", () => {
    expect(subLocationCounts(props)).toEqual({ [fifth.id]: 1, [rehab.id]: 1, [marassi.id]: 1 });
  });

  it("links a listed sub-location to its search, and not a typed one", () => {
    expect(placeLinks(props[0]).subLocation).toBe("/properties?location=new-cairo&area=new-cairo--fifth-settlement");
    expect(placeLinks(props[3]).subLocation).toBeNull();
  });
});

describe("host edits with a sub-location", () => {
  const live = makeProperty({ subLocation: fifth.id });

  it("shows a changed sub-location as one row", () => {
    expect(diffEdit(pickHostEdit(live), pickHostEdit({ ...live, subLocation: rehab.id }))).toEqual([{ field: "subLocation", before: fifth.id, after: rehab.id }]);
  });

  it("shows typed text in that row", () => {
    const typed = pickHostEdit({ ...live, subLocation: null, subLocationCustom: "Golden Square" });
    expect(diffEdit(pickHostEdit(live), typed)).toEqual([{ field: "subLocation", before: fifth.id, after: "Golden Square" }]);
  });

  it("reads an edit held from before sub-locations existed as none", () => {
    const old = pickHostEdit(makeProperty());
    delete (old as Partial<typeof old>).subLocation;
    delete (old as Partial<typeof old>).subLocationCustom;
    expect(diffEdit(pickHostEdit(makeProperty()), old)).toEqual([]);
  });
});
