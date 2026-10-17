import { describe, expect, it } from "vitest";
import {
  checkPhotos,
  encodeWithin,
  fitBudget,
  JPEG_STEPS,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
  MAX_RENTAL_PHOTOS,
  maxPhotos,
  PHOTO_BODY_BUDGET,
  photoTargetChars,
  type JpegStep,
} from "./photo-limits";

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

describe("photo limits", () => {
  it("allows 8 photos on a sale listing and 15 on a rental", () => {
    expect(maxPhotos("sale")).toBe(MAX_PHOTOS);
    expect(maxPhotos("rent")).toBe(MAX_RENTAL_PHOTOS);
    expect(MAX_PHOTOS).toBe(8);
    expect(MAX_RENTAL_PHOTOS).toBe(15);
  });
});

describe("photo upload budget", () => {
  const ACTION_BODY_LIMIT = 4 * 1024 * 1024;

  it("leaves room for the other fields under the 4 MB action body limit", () => {
    expect(PHOTO_BODY_BUDGET + 200_000).toBeLessThanOrEqual(ACTION_BODY_LIMIT);
  });

  it("gives each photo an equal share of an empty budget", () => {
    expect(photoTargetChars(0, 0, MAX_PHOTOS)).toBe(450_000);
    expect(photoTargetChars(0, 0, MAX_RENTAL_PHOTOS)).toBe(240_000);
  });

  it("shares what is left across the free slots", () => {
    // 5 rental photos that came in small leave the other 10 a bigger share.
    expect(photoTargetChars(5 * 100_000, 5, MAX_RENTAL_PHOTOS)).toBe(310_000);
  });

  it("never goes negative, even with no budget or no slots left", () => {
    expect(photoTargetChars(PHOTO_BODY_BUDGET + 1, 3, MAX_RENTAL_PHOTOS)).toBe(0);
    expect(photoTargetChars(0, MAX_PHOTOS, MAX_PHOTOS)).toBe(PHOTO_BODY_BUDGET);
  });

  it.each([MAX_PHOTOS, MAX_RENTAL_PHOTOS])("fits a full set of %i photos, picked one by one, each at its full share", (limit) => {
    let used = 0;
    for (let count = 0; count < limit; count++) used += photoTargetChars(used, count, limit);
    expect(used).toBeLessThanOrEqual(PHOTO_BODY_BUDGET);
  });

  it("fits a full set picked all at once", () => {
    expect(MAX_RENTAL_PHOTOS * photoTargetChars(0, 0, MAX_RENTAL_PHOTOS)).toBeLessThanOrEqual(PHOTO_BODY_BUDGET);
  });
});

describe("fitBudget", () => {
  const photo = (chars: number) => "x".repeat(chars);

  it("keeps every photo that fits", () => {
    expect(fitBudget([photo(10), photo(20)], 0)).toHaveLength(2);
  });

  it("keeps a photo that exactly fills the budget", () => {
    expect(fitBudget([photo(100)], PHOTO_BODY_BUDGET - 100)).toHaveLength(1);
  });

  it("stops at the first photo that would overflow, keeping order", () => {
    const [a, b, c] = [photo(100), photo(300), photo(50)];
    expect(fitBudget([a, b, c], PHOTO_BODY_BUDGET - 350)).toEqual([a]);
  });

  it("keeps nothing once the budget is used up", () => {
    expect(fitBudget([photo(1)], PHOTO_BODY_BUDGET)).toEqual([]);
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
