// Size rules for photos picked in the browser, kept free of DOM code so they can be unit tested.
export const MAX_PHOTO_MB = 6;
export const MAX_PHOTO_BYTES = MAX_PHOTO_MB * 1024 * 1024;

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
