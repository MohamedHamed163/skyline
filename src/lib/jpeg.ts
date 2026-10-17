import { encodeWithin } from "./photo-limits";

// Browser-only: downscale an image file to a JPEG data URL so uploads stay small. With `maxChars`,
// quality and then size are stepped down until the data URL fits (see encodeWithin).
export async function toJpegDataUrl(file: File, maxChars = Infinity) {
  const bitmap = await createImageBitmap(file);
  try {
    return encodeWithin(({ maxSide, quality }) => {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", quality);
    }, maxChars);
  } finally {
    bitmap.close();
  }
}
