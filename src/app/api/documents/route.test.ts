import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_DOCUMENT_BYTES } from "@/lib/document-limits";
import { LIMITS, limiter } from "@/lib/rate-limit";

// handleUpload is mocked to run our onBeforeGenerateToken and return what it decided.
const blob = vi.hoisted(() => ({
  handleUpload: vi.fn(async ({ body, onBeforeGenerateToken }) => ({
    type: "blob.generate-client-token",
    clientToken: JSON.stringify(await onBeforeGenerateToken(body.payload.pathname, null, false)),
  })),
}));
vi.mock("@vercel/blob/client", () => blob);

const { POST } = await import("./route");

const IP = "203.0.113.7";
const OTHER_IP = "198.51.100.1";
const tokenRequest = (pathname: string, ip = IP) =>
  new Request("http://localhost/api/documents", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ type: "blob.generate-client-token", payload: { pathname, clientPayload: null, multipart: false } }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  for (const ip of [IP, OTHER_IP]) limiter.reset(`documents:${ip}`);
});

describe("POST /api/documents", () => {
  it("issues a token limited to the document's type and size, with a random suffix and short expiry", async () => {
    const res = await POST(tokenRequest("documents/brochure.pdf"));
    expect(res.status).toBe(200);
    const { clientToken } = await res.json();
    const rules = JSON.parse(clientToken);
    expect(rules).toMatchObject({ allowedContentTypes: ["application/pdf"], maximumSizeInBytes: MAX_DOCUMENT_BYTES, addRandomSuffix: true });
    expect(rules.validUntil - Date.now()).toBeGreaterThan(0);
    expect(rules.validUntil - Date.now()).toBeLessThanOrEqual(10 * 60_000);
  });

  it("refuses paths that aren't a brochure or payment plan", async () => {
    for (const pathname of ["properties/photo.jpg", "documents/brochure.xlsx", "documents/contract.pdf"]) {
      expect((await POST(tokenRequest(pathname))).status).toBe(400);
    }
  });

  it("refuses upload-completed callbacks, since none are registered", async () => {
    const req = new Request("http://localhost/api/documents", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": IP },
      body: JSON.stringify({ type: "blob.upload-completed", payload: {} }),
    });
    expect((await POST(req)).status).toBe(400);
    expect(blob.handleUpload).not.toHaveBeenCalled();
  });

  it("refuses a body that isn't JSON", async () => {
    const req = new Request("http://localhost/api/documents", { method: "POST", headers: { "x-forwarded-for": IP }, body: "nope" });
    expect((await POST(req)).status).toBe(400);
  });

  it("rate limits uploads per IP", async () => {
    for (let i = 0; i < LIMITS.documentUpload.max; i++) expect((await POST(tokenRequest("documents/brochure.pdf"))).status).toBe(200);
    const blocked = await POST(tokenRequest("documents/brochure.pdf"));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
    // Another visitor is unaffected.
    expect((await POST(tokenRequest("documents/brochure.pdf", OTHER_IP))).status).toBe(200);
  });
});
