import { describe, expect, it } from "vitest";
import { makeProperty } from "@/test/fixtures";
import { descriptionSections, hasDeveloperDescription } from "./descriptions";

describe("hasDeveloperDescription", () => {
  it("is true for Primary listings for sale only", () => {
    expect(hasDeveloperDescription({ listingType: "primary", purpose: "sale" })).toBe(true);
    expect(hasDeveloperDescription({ listingType: "resale", purpose: "sale" })).toBe(false);
    expect(hasDeveloperDescription({ listingType: "primary", purpose: "rent" })).toBe(false);
    expect(hasDeveloperDescription({ listingType: "resale", purpose: "rent" })).toBe(false);
  });
});

describe("descriptionSections", () => {
  const primary = makeProperty({ listingType: "primary", description: "The project.", developerDescription: "The developer." });

  it("shows About the project, then About the developer, on Primary listings", () => {
    expect(descriptionSections(primary)).toEqual([
      { kind: "project", text: "The project." },
      { kind: "developer", text: "The developer." },
    ]);
  });

  it("leaves out whichever Primary description is empty", () => {
    expect(descriptionSections({ ...primary, developerDescription: "" })).toEqual([{ kind: "project", text: "The project." }]);
    expect(descriptionSections({ ...primary, description: "" })).toEqual([{ kind: "developer", text: "The developer." }]);
    expect(descriptionSections({ ...primary, description: "", developerDescription: "" })).toEqual([]);
  });

  it("shows a single Overview on Resale listings and rentals, never a developer text", () => {
    const stray = { description: "A flat.", developerDescription: "Should not show." };
    expect(descriptionSections(makeProperty({ listingType: "resale", ...stray }))).toEqual([{ kind: "overview", text: "A flat." }]);
    expect(descriptionSections(makeProperty({ listingType: "primary", purpose: "rent", rentPeriod: "month", ...stray }))).toEqual([{ kind: "overview", text: "A flat." }]);
    expect(descriptionSections(makeProperty({ description: "" }))).toEqual([]);
  });

  it("handles Primary listings cached before the developer description existed", () => {
    const old: Partial<typeof primary> = { ...primary };
    delete old.developerDescription;
    expect(descriptionSections(old as typeof primary)).toEqual([{ kind: "project", text: "The project." }]);
  });
});
