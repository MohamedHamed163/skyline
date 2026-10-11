// Rules for the documents attached to a Primary submission (docs/primary-documents.md): which files
// are allowed, how big, and what a stored document URL must look like. Kept free of DOM and server
// code so the upload field, the upload-token route and the server action share them, and so they
// can be unit tested.
import { DOCUMENT_KINDS, type DocumentKind, type PropertyDocument } from "./types";

export const MAX_DOCUMENT_MB = 20;
export const MAX_DOCUMENT_BYTES = MAX_DOCUMENT_MB * 1024 * 1024;
export const MAX_DOCUMENT_NAME = 120;
const MAX_URL = 500;

const PDF = "application/pdf";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const XLS = "application/vnd.ms-excel";

/** Allowed file extensions per kind, with the content type each one is uploaded as. */
export const DOCUMENT_TYPES: Record<DocumentKind, Record<string, string>> = {
  brochure: { pdf: PDF },
  paymentPlan: { pdf: PDF, xlsx: XLSX, xls: XLS },
};

/** Blob stores serve public files from <store>.public.blob.vercel-storage.com. */
const BLOB_HOST = ".public.blob.vercel-storage.com";

const extension = (fileName: string) => /\.([a-z0-9]+)$/i.exec(fileName)?.[1].toLowerCase() ?? "";

// Object.hasOwn: an extension such as "constructor" must not match an inherited property.
const typeFor = (kind: DocumentKind, ext: string) =>
  Object.hasOwn(DOCUMENT_TYPES[kind], ext) ? DOCUMENT_TYPES[kind][ext] : undefined;

/** The file picker's `accept` value, e.g. ".pdf,.xlsx,.xls". */
export const acceptFor = (kind: DocumentKind) =>
  Object.keys(DOCUMENT_TYPES[kind])
    .map((ext) => `.${ext}`)
    .join(",");

/** The content type a picked file is uploaded as, or undefined when its type isn't allowed. */
export const documentContentType = (kind: DocumentKind, fileName: string) => typeFor(kind, extension(fileName));

export type DocumentProblem = "badType" | "tooLarge";

/** Checks a picked file before it is uploaded. The type is judged by the extension. */
export function checkDocument(kind: DocumentKind, file: { name: string; size: number }): DocumentProblem | null {
  if (!documentContentType(kind, file.name)) return "badType";
  if (file.size > MAX_DOCUMENT_BYTES) return "tooLarge";
  return null;
}

/**
 * Where an upload goes in the Blob store, e.g. "documents/paymentPlan.xlsx". The seller's file
 * name stays out of the URL; Blob adds a random suffix so URLs can't be guessed.
 */
export const documentPathname = (kind: DocumentKind, fileName: string) => `documents/${kind}.${extension(fileName)}`;

/**
 * Upload-token limits for a pathname the browser asks to upload to, or null when it isn't one
 * `documentPathname` hands out. The token only accepts that one content type, up to the size limit.
 */
export function uploadRules(pathname: string) {
  const m = /^documents\/([A-Za-z]+)\.([a-z0-9]+)$/.exec(pathname);
  const kind = DOCUMENT_KINDS.find((k) => k === m?.[1]);
  const contentType = kind && typeFor(kind, m![2]);
  if (!contentType) return null;
  return { allowedContentTypes: [contentType], maximumSizeInBytes: MAX_DOCUMENT_BYTES };
}

/** A public Vercel Blob URL for a document of this kind, as returned after an upload. */
export function isDocumentUrl(kind: DocumentKind, url: string) {
  if (url.length > MAX_URL) return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const m = /^\/documents\/([A-Za-z]+)(?:-[A-Za-z0-9]+)?\.([a-z0-9]+)$/.exec(u.pathname);
  return (
    u.protocol === "https:" &&
    u.hostname.endsWith(BLOB_HOST) &&
    !u.port &&
    !u.username &&
    !u.search &&
    !u.hash &&
    m?.[1] === kind &&
    Boolean(typeFor(kind, m[2]))
  );
}

/** A file name safe to show: no control or text-direction characters, at most MAX_DOCUMENT_NAME long. */
export const cleanDocumentName = (name: string) =>
  name
    .replace(/[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/g, "")
    .trim()
    .slice(0, MAX_DOCUMENT_NAME);

/**
 * Reads the documents sent with a submission (`brochureUrl` / `brochureName`, `paymentPlanUrl` /
 * `paymentPlanName`). Kinds left empty are skipped; null when any URL isn't a document upload.
 */
export function readDocuments(fd: FormData): PropertyDocument[] | null {
  const documents: PropertyDocument[] = [];
  for (const kind of DOCUMENT_KINDS) {
    const url = String(fd.get(`${kind}Url`) ?? "").trim();
    if (!url) continue;
    if (!isDocumentUrl(kind, url)) return null;
    const name = cleanDocumentName(String(fd.get(`${kind}Name`) ?? "")) || url.slice(url.lastIndexOf("/") + 1);
    documents.push({ kind, url, name });
  }
  return documents;
}

/** A file size in megabytes with one decimal, never shown as "0.0". */
export const sizeInMb = (bytes: number) => Math.max(0.1, bytes / 1024 / 1024).toFixed(1);
