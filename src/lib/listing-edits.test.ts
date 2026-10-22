import { describe, expect, it } from "vitest";
import { makeProperty } from "@/test/fixtures";
import { diffEdit, HOST_EDIT_KEYS, holdsEdits, photoChanges, pickHostEdit, withPendingEdit } from "./listing-edits";
import { PROPERTY_STATUSES } from "./types";

const live = makeProperty({ title: "Old title", price: 1_000_000, features: ["Garden", "Parking"], photos: ["a.jpg", "b.jpg"] });
const edit = (o: Parameters<typeof makeProperty>[0] = {}) => pickHostEdit({ ...live, ...o });

describe("pickHostEdit", () => {
  it("keeps only the fields a host can change", () => {
    const picked = pickHostEdit(makeProperty({ featured: true, adminNotes: "x" }));
    expect(Object.keys(picked).sort()).toEqual([...HOST_EDIT_KEYS].sort());
    expect(picked).not.toHaveProperty("featured");
    expect(picked).not.toHaveProperty("adminNotes");
  });
});

describe("holdsEdits", () => {
  it("holds edits only once the listing is live", () => {
    for (const status of PROPERTY_STATUSES) expect(holdsEdits({ status }), status).toBe(status === "published");
  });
});

describe("withPendingEdit", () => {
  it("shows the waiting edit on top of the live listing, for the edit form", () => {
    const p = { ...live, pendingEdit: { values: edit({ title: "New title" }), submittedAt: "2026-10-17T10:00:00.000Z" } };
    expect(withPendingEdit(p)).toEqual(expect.objectContaining({ title: "New title", price: 1_000_000, status: "published", id: live.id }));
    expect(withPendingEdit(live)).toBe(live);
  });
});

describe("diffEdit", () => {
  it("lists a changed unit range as its own row (docs/unit-ranges.md)", () => {
    expect(diffEdit(live, edit({ areaMax: 400 }))).toEqual([{ field: "areaMax", before: null, after: 400 }]);
  });

  it("is empty when nothing changed", () => {
    expect(diffEdit(live, edit())).toEqual([]);
  });

  it("lists each changed field with its live and proposed value, in form order", () => {
    expect(diffEdit(live, edit({ price: 1_200_000, title: "New title" }))).toEqual([
      { field: "title", before: "Old title", after: "New title" },
      { field: "price", before: 1_000_000, after: 1_200_000 },
    ]);
  });

  it("splits the seller details into their parts", () => {
    expect(diffEdit(live, edit({ seller: { ...live.seller, phone: "+20 111 111 1111" } }))).toEqual([
      { field: "sellerPhone", before: live.seller.phone, after: "+20 111 111 1111" },
    ]);
  });

  it("ignores the order features were ticked in", () => {
    expect(diffEdit(live, edit({ features: ["Parking", "Garden"] }))).toEqual([]);
    expect(diffEdit(live, edit({ features: ["Garden"] }))).toEqual([{ field: "features", before: ["Garden", "Parking"], after: ["Garden"] }]);
  });

  it("compares photos in order, since the first is the main image", () => {
    expect(diffEdit(live, edit({ photos: ["b.jpg", "a.jpg"] }))).toEqual([{ field: "photos", before: ["a.jpg", "b.jpg"], after: ["b.jpg", "a.jpg"] }]);
  });

  it("treats a cleared floor as a change to none", () => {
    expect(diffEdit({ ...live, floor: 3 }, edit({ floor: null }))).toEqual([{ field: "floor", before: 3, after: null }]);
  });
});

describe("photoChanges", () => {
  it("names the photos added and removed", () => {
    expect(photoChanges(["a.jpg", "b.jpg"], ["b.jpg", "c.jpg"])).toEqual({ added: ["c.jpg"], removed: ["a.jpg"] });
  });
});
