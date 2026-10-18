import { describe, expect, it } from "vitest";
import { makeProperty } from "@/test/fixtures";
import { listingSection, matchesListing } from "./admin-lists";

const primarySale = makeProperty({ id: "a", purpose: "sale", listingType: "primary" });
const resaleSale = makeProperty({ id: "b", purpose: "sale", listingType: "resale" });
const primaryRent = makeProperty({ id: "c", purpose: "rent", listingType: "primary" });
const resaleRent = makeProperty({ id: "d", purpose: "rent", listingType: "resale" });
const all = [primarySale, resaleSale, primaryRent, resaleRent];
const ids = (purpose?: "sale" | "rent", listing?: "primary" | "resale") =>
  all.filter((p) => matchesListing(p, purpose, listing)).map((p) => p.id);

describe("admin listing sections", () => {
  it("puts every rental in Rent whatever listing type it stores", () => {
    expect(all.map(listingSection)).toEqual(["primary", "resale", "rent", "rent"]);
  });

  it("Primary Listings shows primary sales only, never rentals", () => {
    expect(ids(undefined, "primary")).toEqual(["a"]);
    expect(ids("sale", "primary")).toEqual(["a"]);
  });

  it("Resale Listings shows resale sales only, never rentals", () => {
    expect(ids(undefined, "resale")).toEqual(["b"]);
  });

  it("Rentals shows rentals only", () => {
    expect(ids("rent")).toEqual(["c", "d"]);
  });

  it("Rent wins over a listing type, since listing types don't apply to rentals", () => {
    expect(ids("rent", "primary")).toEqual(["c", "d"]);
  });

  it("no filter shows everything and Sale shows every sale", () => {
    expect(ids()).toEqual(["a", "b", "c", "d"]);
    expect(ids("sale")).toEqual(["a", "b"]);
  });
});
