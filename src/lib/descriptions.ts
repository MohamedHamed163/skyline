import type { Property } from "./types";

// Primary listings are described in two parts, the project and its developer
// (docs/developer-description.md). Resale listings and rentals keep a single description.

/** Whether a listing gets the "About the developer" text: Primary listings for sale. */
export const hasDeveloperDescription = (p: Pick<Property, "listingType" | "purpose">) => p.purpose === "sale" && p.listingType === "primary";

export type DescriptionSection = { kind: "overview" | "project" | "developer"; text: string };

/**
 * The description blocks the property page shows, in order, leaving out empty ones: "About the
 * project" then "About the developer" on Primary listings, a single "Overview" otherwise.
 * `developerDescription` may be missing on properties cached before the field existed.
 */
export function descriptionSections(p: Pick<Property, "listingType" | "purpose" | "description" | "developerDescription">): DescriptionSection[] {
  const sections: DescriptionSection[] = hasDeveloperDescription(p)
    ? [
        { kind: "project", text: p.description },
        { kind: "developer", text: p.developerDescription ?? "" },
      ]
    : [{ kind: "overview", text: p.description }];
  return sections.filter((s) => s.text);
}
