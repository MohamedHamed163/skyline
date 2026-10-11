import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { uploadRules } from "@/lib/document-limits";
import { clientIp, LIMITS, limiter } from "@/lib/rate-limit";

const TOKEN_TTL_MS = 10 * 60_000;

// Hands the browser a short-lived token to upload one Primary-listing document (brochure or payment
// plan) straight to Vercel Blob (docs/primary-documents.md). The file never passes through this
// server, so it isn't held to the 4 MB server-action body limit. Each token accepts only the
// document's own content type, up to MAX_DOCUMENT_MB.
export async function POST(request: Request) {
  const hit = limiter.hit(`documents:${clientIp(request.headers)}`, LIMITS.documentUpload);
  if (!hit.ok) {
    return Response.json({ error: "Too many uploads" }, { status: 429, headers: { "Retry-After": String(Math.ceil(hit.resetMs / 1000)) } });
  }
  try {
    const body = (await request.json()) as HandleUploadBody;
    // No upload-completed callback is registered: the form sends the URL with the submission.
    if (body?.type !== "blob.generate-client-token") return Response.json({ error: "Unsupported request" }, { status: 400 });
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const rules = uploadRules(pathname);
        if (!rules) throw new Error("Unsupported document");
        return { ...rules, addRandomSuffix: true, validUntil: Date.now() + TOKEN_TTL_MS };
      },
    });
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Upload failed" }, { status: 400 });
  }
}
