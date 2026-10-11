import "server-only";
import { head } from "@vercel/blob";
import { DOCUMENT_TYPES, MAX_DOCUMENT_BYTES } from "./document-limits";
import type { PropertyDocument } from "./types";

/**
 * Checks that a submitted document really is a file in this app's Blob store (head() only sees
 * our own store) with an allowed type and size. False for anything else, including lookups that
 * fail, so the seller is asked to upload it again.
 */
export async function verifyDocument(doc: PropertyDocument) {
  try {
    const blob = await head(doc.url);
    return blob.size <= MAX_DOCUMENT_BYTES && Object.values(DOCUMENT_TYPES[doc.kind]).includes(blob.contentType);
  } catch (err) {
    console.error("Document check failed", doc.url, err);
    return false;
  }
}
