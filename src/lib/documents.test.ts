import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_DOCUMENT_BYTES } from "./document-limits";
import type { PropertyDocument } from "./types";

const blob = vi.hoisted(() => ({ head: vi.fn() }));
vi.mock("@vercel/blob", () => blob);

const { verifyDocument } = await import("./documents");

const doc = (o: Partial<PropertyDocument> = {}): PropertyDocument => ({
  kind: "paymentPlan",
  url: "https://abc.public.blob.vercel-storage.com/documents/paymentPlan-a1.xlsx",
  name: "plan.xlsx",
  ...o,
});

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("verifyDocument", () => {
  it("accepts a file in our store with an allowed type and size", async () => {
    blob.head.mockResolvedValue({ size: MAX_DOCUMENT_BYTES, contentType: XLSX });
    expect(await verifyDocument(doc())).toBe(true);
    expect(blob.head).toHaveBeenCalledWith(doc().url);
  });

  it("rejects a file over the size limit", async () => {
    blob.head.mockResolvedValue({ size: MAX_DOCUMENT_BYTES + 1, contentType: XLSX });
    expect(await verifyDocument(doc())).toBe(false);
  });

  it("rejects a type the kind doesn't allow", async () => {
    blob.head.mockResolvedValue({ size: 1000, contentType: XLSX });
    expect(await verifyDocument(doc({ kind: "brochure" }))).toBe(false);
    blob.head.mockResolvedValue({ size: 1000, contentType: "text/html" });
    expect(await verifyDocument(doc())).toBe(false);
  });

  it("rejects files the store doesn't have (another store, deleted, lookup failed)", async () => {
    blob.head.mockRejectedValue(new Error("BlobNotFoundError"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    expect(await verifyDocument(doc())).toBe(false);
  });
});
