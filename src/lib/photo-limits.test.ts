import { describe, expect, it } from "vitest";
import { checkPhotos, encodeWithin, JPEG_STEPS, MAX_PHOTO_BYTES, MAX_PHOTOS, PHOTO_TARGET_CHARS, type JpegStep } from "./photo-limits";

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

describe("photo upload budget", () => {
  it("allows 8 photos per property", () => {
    expect(MAX_PHOTOS).toBe(8);
  });

  it("keeps a full set of photos, plus room for the other fields, under the 4 MB action body limit", () => {
    expect(MAX_PHOTOS * PHOTO_TARGET_CHARS + 200_000).toBeLessThanOrEqual(4 * 1024 * 1024);
  });
});

describe("encodeWithin", () => {
  // A fake encoder whose output length is the pixel budget scaled by quality.
  const fake = (calls: JpegStep[]) => (step: JpegStep) => {
    calls.push(step);
    return "x".repeat(Math.round(step.maxSide * step.quality));
  };

  it("keeps the first, best encoding when it already fits", () => {
    const calls: JpegStep[] = [];
    expect(encodeWithin(fake(calls), Infinity)).toHaveLength(Math.round(1280 * 0.72));
    expect(calls).toEqual([JPEG_STEPS[0]]);
  });

  it("steps quality down before size", () => {
    const calls: JpegStep[] = [];
    expect(encodeWithin(fake(calls), 800)).toHaveLength(1280 * 0.6);
    expect(calls).toEqual(JPEG_STEPS.slice(0, 2));
  });

  it("shrinks the photo once lower quality is not enough", () => {
    const calls: JpegStep[] = [];
    expect(encodeWithin(fake(calls), 500)).toHaveLength(800 * 0.6);
    expect(calls).toEqual(JPEG_STEPS);
  });

  it("returns the smallest attempt when nothing fits", () => {
    expect(encodeWithin(fake([]), 10)).toHaveLength(800 * 0.6);
  });
});
