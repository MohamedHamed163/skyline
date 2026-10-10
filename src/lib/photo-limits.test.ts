import { describe, expect, it } from "vitest";
import { checkPhotos, MAX_PHOTO_BYTES } from "./photo-limits";

const file = (name: string, size: number) => ({ name, size });

describe("checkPhotos", () => {
  it("accepts photos up to exactly 6 MB", () => {
    const r = checkPhotos([file("a.jpg", 1000), file("b.jpg", MAX_PHOTO_BYTES)]);
    expect(r.accepted.map((f) => f.name)).toEqual(["a.jpg", "b.jpg"]);
    expect(r.tooLarge).toEqual([]);
    expect(r.overCount).toBe(false);
  });

  it("drops photos over 6 MB and names them", () => {
    const r = checkPhotos([file("big.jpg", MAX_PHOTO_BYTES + 1), file("ok.jpg", 10)]);
    expect(r.accepted.map((f) => f.name)).toEqual(["ok.jpg"]);
    expect(r.tooLarge).toEqual(["big.jpg"]);
  });

  it("does not let an oversized photo use up a free slot", () => {
    const r = checkPhotos([file("big.jpg", MAX_PHOTO_BYTES * 2), file("a.jpg", 1), file("b.jpg", 1)], 2);
    expect(r.accepted.map((f) => f.name)).toEqual(["a.jpg", "b.jpg"]);
    expect(r.overCount).toBe(false);
  });

  it("flags when more fitting photos were picked than there is room for", () => {
    const r = checkPhotos([file("a.jpg", 1), file("b.jpg", 1), file("c.jpg", 1)], 2);
    expect(r.accepted).toHaveLength(2);
    expect(r.overCount).toBe(true);
  });

  it("accepts nothing when there is no room left", () => {
    const r = checkPhotos([file("a.jpg", 1)], 0);
    expect(r.accepted).toEqual([]);
    expect(r.overCount).toBe(true);
  });
});
