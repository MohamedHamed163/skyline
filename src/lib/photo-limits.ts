import type { Purpose } from "./types";

// Size rules for photos picked in the browser, kept free of DOM code so they can be unit tested.
export const MAX_PHOTO_MB = 6;
export const MAX_PHOTO_BYTES = MAX_PHOTO_MB * 1024 * 1024;

/** Most photos a sale listing can have, on /submit and the admin "new property" form. */
export const MAX_PHOTOS = 8;
/** Most photos a rental can have. Only the admin adds rentals. */
export const MAX_RENTAL_PHOTOS = 15;

export const maxPhotos = (purpose: Purpose) => (purpose === "rent" ? MAX_RENTAL_PHOTOS : MAX_PHOTOS);

// The downscaled photos travel in the server-action body, capped at 4 MB in next.config.ts (under
// Vercel's 4.5 MB request limit). Photos share this budget, which leaves room for the other fields.
export const PHOTO_BODY_BUDGET = 3_600_000;

/**
 * The size to encode each newly picked photo within: an equal share of what is left of the budget
 * across the free slots. Photos that come in under their share leave more for later ones, and the
 * set never outgrows the budget while each photo fits its share.
 */
export function photoTargetChars(usedChars: number, count: number, limit: number) {
  return Math.floor(Math.max(0, PHOTO_BODY_BUDGET - usedChars) / Math.max(1, limit - count));
}

/**
 * Keeps the new photos, in order, while the running total stays within the budget. In practice it
 * only drops one when a sale listing already used most of the budget and was then switched to a
 * rental, leaving little room for the extra slots.
 */
export function fitBudget(added: string[], usedChars: number) {
  const kept: string[] = [];
  let total = usedChars;
  for (const photo of added) {
    if (total + photo.length > PHOTO_BODY_BUDGET) break;
    kept.push(photo);
    total += photo.length;
  }
  return kept;
}

type Picked = { name: string; size: number };

/**
 * Splits picked files into the ones to keep and the names of those over the size limit.
 * Oversized files are dropped before `room` is applied, so they never take a free slot.
 */
export function checkPhotos<F extends Picked>(files: F[], room = Infinity) {
  const fitting = files.filter((f) => f.size <= MAX_PHOTO_BYTES);
  return {
    accepted: fitting.slice(0, Math.max(0, room)),
    tooLarge: files.filter((f) => f.size > MAX_PHOTO_BYTES).map((f) => f.name),
    overCount: fitting.length > room,
  };
}

export type JpegStep = { maxSide: number; quality: number };

/** Downscale attempts, best first: full size at the usual quality, then lower quality, then smaller. */
export const JPEG_STEPS: readonly JpegStep[] = [
  { maxSide: 1280, quality: 0.72 },
  { maxSide: 1280, quality: 0.6 },
  { maxSide: 1024, quality: 0.6 },
  { maxSide: 800, quality: 0.6 },
];

/** Encodes with each step in turn and returns the first result within `maxChars`, else the last one. */
export function encodeWithin(encode: (step: JpegStep) => string, maxChars: number, steps = JPEG_STEPS) {
  let out = "";
  for (const step of steps) {
    out = encode(step);
    if (out.length <= maxChars) break;
  }
  return out;
}
