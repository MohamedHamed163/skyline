import { describe, expect, it } from "vitest";
import {
  acceptFor,
  checkDocument,
  cleanDocumentName,
  documentContentType,
  documentPathname,
  isDocumentUrl,
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENT_NAME,
  readDocuments,
  sizeInMb,
  uploadRules,
} from "./document-limits";

const PDF = "application/pdf";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const XLS = "application/vnd.ms-excel";
const BLOB = "https://abc123.public.blob.vercel-storage.com";

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
};

describe("allowed document types", () => {
  it("takes only PDF for the brochure, and PDF or Excel for the payment plan", () => {
    expect(acceptFor("brochure")).toBe(".pdf");
    expect(acceptFor("paymentPlan")).toBe(".pdf,.xlsx,.xls");
    expect(documentContentType("brochure", "Project.PDF")).toBe(PDF);
    expect(documentContentType("paymentPlan", "plan.xlsx")).toBe(XLSX);
    expect(documentContentType("paymentPlan", "plan.xls")).toBe(XLS);
    expect(documentContentType("brochure", "plan.xlsx")).toBeUndefined();
  });

  it("rejects files without an allowed extension, including object property names", () => {
    for (const name of ["brochure", "pdf", "photo.jpg", "plan.csv", "x.pdf.exe", "x.constructor", "x.tostring"]) {
      expect(documentContentType("paymentPlan", name)).toBeUndefined();
    }
  });
});

describe("checkDocument", () => {
  it("accepts an allowed file exactly at the size limit", () => {
    expect(checkDocument("brochure", { name: "b.pdf", size: MAX_DOCUMENT_BYTES })).toBeNull();
  });

  it("rejects a file one byte over the limit", () => {
    expect(checkDocument("brochure", { name: "b.pdf", size: MAX_DOCUMENT_BYTES + 1 })).toBe("tooLarge");
  });

  it("reports the wrong type before the size", () => {
    expect(checkDocument("brochure", { name: "plan.xlsx", size: MAX_DOCUMENT_BYTES + 1 })).toBe("badType");
  });
});

describe("upload paths and token rules", () => {
  it("builds a path from the kind and extension only", () => {
    expect(documentPathname("paymentPlan", "خطة السداد 2026.XLSX")).toBe("documents/paymentPlan.xlsx");
    expect(documentPathname("brochure", "brochure.pdf")).toBe("documents/brochure.pdf");
  });

  it("gives every handed-out path a token for its one content type and the size limit", () => {
    expect(uploadRules("documents/brochure.pdf")).toEqual({ allowedContentTypes: [PDF], maximumSizeInBytes: MAX_DOCUMENT_BYTES });
    expect(uploadRules("documents/paymentPlan.xls")).toEqual({ allowedContentTypes: [XLS], maximumSizeInBytes: MAX_DOCUMENT_BYTES });
  });

  it("refuses any other path", () => {
    const bad = [
      "documents/brochure.xlsx",
      "documents/contract.pdf",
      "documents/brochure.constructor",
      "properties/photo.jpg",
      "documents/../properties/brochure.pdf",
      "documents/brochure.pdf/x",
      "/documents/brochure.pdf",
      "",
    ];
    for (const pathname of bad) expect(uploadRules(pathname)).toBeNull();
  });
});

describe("isDocumentUrl", () => {
  it("accepts a Blob URL of the right kind, with or without the random suffix", () => {
    expect(isDocumentUrl("brochure", `${BLOB}/documents/brochure-Xy12Ab34.pdf`)).toBe(true);
    expect(isDocumentUrl("paymentPlan", `${BLOB}/documents/paymentPlan.xlsx`)).toBe(true);
  });

  it("rejects other hosts, kinds, types and decorated URLs", () => {
    const bad: [Parameters<typeof isDocumentUrl>[0], string][] = [
      ["brochure", "https://evil.example/documents/brochure-a.pdf"],
      ["brochure", "https://public.blob.vercel-storage.com.evil.example/documents/brochure-a.pdf"],
      ["brochure", `${BLOB.replace("https", "http")}/documents/brochure-a.pdf`],
      ["brochure", `${BLOB}/documents/paymentPlan-a.pdf`],
      ["brochure", `${BLOB}/documents/brochure-a.xlsx`],
      ["brochure", `${BLOB}/properties/brochure-a.pdf`],
      ["brochure", `${BLOB}/documents/brochure-a.pdf?download=1`],
      ["brochure", `${BLOB}/documents/brochure-a.pdf#x`],
      ["brochure", `${BLOB}:8443/documents/brochure-a.pdf`],
      ["brochure", `https://user:pw@abc123.public.blob.vercel-storage.com/documents/brochure-a.pdf`],
      ["brochure", `${BLOB}/documents/brochure-${"a".repeat(500)}.pdf`],
      ["brochure", "javascript:alert(1)"],
      ["brochure", "not a url"],
    ];
    for (const [kind, url] of bad) expect(isDocumentUrl(kind, url), url).toBe(false);
  });
});

describe("cleanDocumentName", () => {
  it("drops control and text-direction characters and trims", () => {
    expect(cleanDocumentName("  plan\u0000\n.pdf ")).toBe("plan.pdf");
    expect(cleanDocumentName("x‮fdp.exe")).toBe("xfdp.exe");
  });

  it("keeps Arabic names and caps the length", () => {
    expect(cleanDocumentName("خطة السداد.xlsx")).toBe("خطة السداد.xlsx");
    expect(cleanDocumentName("a".repeat(300))).toHaveLength(MAX_DOCUMENT_NAME);
  });
});

describe("readDocuments", () => {
  it("returns nothing when no file was attached", () => {
    expect(readDocuments(form({ title: "x" }))).toEqual([]);
    expect(readDocuments(form({ brochureUrl: " ", paymentPlanUrl: "" }))).toEqual([]);
  });

  it("reads both documents with their original names", () => {
    const fd = form({
      brochureUrl: `${BLOB}/documents/brochure-a1.pdf`,
      brochureName: "Palm Hills brochure.pdf",
      paymentPlanUrl: `${BLOB}/documents/paymentPlan-b2.xlsx`,
      paymentPlanName: "plan.xlsx",
    });
    expect(readDocuments(fd)).toEqual([
      { kind: "brochure", url: `${BLOB}/documents/brochure-a1.pdf`, name: "Palm Hills brochure.pdf" },
      { kind: "paymentPlan", url: `${BLOB}/documents/paymentPlan-b2.xlsx`, name: "plan.xlsx" },
    ]);
  });

  it("falls back to the stored file name when the name is missing", () => {
    expect(readDocuments(form({ paymentPlanUrl: `${BLOB}/documents/paymentPlan-b2.pdf` }))).toEqual([
      { kind: "paymentPlan", url: `${BLOB}/documents/paymentPlan-b2.pdf`, name: "paymentPlan-b2.pdf" },
    ]);
  });

  it("fails when any URL isn't a document upload", () => {
    expect(readDocuments(form({ brochureUrl: `${BLOB}/documents/brochure-a1.pdf`, paymentPlanUrl: "https://evil.example/plan.xlsx" }))).toBeNull();
  });
});

describe("sizeInMb", () => {
  it("shows one decimal and never 0.0", () => {
    expect(sizeInMb(3.25 * 1024 * 1024)).toBe("3.3");
    expect(sizeInMb(MAX_DOCUMENT_BYTES)).toBe("20.0");
    expect(sizeInMb(10)).toBe("0.1");
  });
});
