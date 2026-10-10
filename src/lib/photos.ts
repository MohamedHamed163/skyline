import "server-only";
import { put } from "@vercel/blob";

const PREFIX = "data:image/jpeg;base64,";

/** Uploads browser-downscaled JPEG data URLs to Vercel Blob and returns their public URLs. */
export async function uploadPhotos(dataUrls: string[]) {
  return Promise.all(
    dataUrls.map(async (dataUrl) => {
      const body = Buffer.from(dataUrl.slice(PREFIX.length), "base64");
      const blob = await put("properties/photo.jpg", body, {
        access: "public",
        contentType: "image/jpeg",
        addRandomSuffix: true,
      });
      return blob.url;
    }),
  );
}
