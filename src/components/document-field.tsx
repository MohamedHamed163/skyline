"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useRef, useState } from "react";
import { fmt, useDict } from "@/lib/i18n/client";
import { acceptFor, checkDocument, documentContentType, documentPathname, MAX_DOCUMENT_MB, sizeInMb } from "@/lib/document-limits";
import type { DocumentKind } from "@/lib/types";

type State =
  | { step: "empty"; error?: string }
  | { step: "uploading"; name: string; percent: number }
  | { step: "done"; name: string; size: number; url: string };

/**
 * One optional document slot on a Primary submission (docs/primary-documents.md). The picked file
 * is checked, then uploaded straight to Vercel Blob with a token from /api/documents, showing its
 * progress. Once uploaded, hidden `{kind}Url` / `{kind}Name` inputs carry it with the form.
 * `onBusy` reports whether an upload is running, so the form can wait for it.
 */
export function DocumentField({ kind, onBusy }: { kind: DocumentKind; onBusy: (kind: DocumentKind, busy: boolean) => void }) {
  const t = useDict();
  const s = t.submit;
  const [state, setState] = useState<State>({ step: "empty" });
  const abort = useRef<AbortController | null>(null);
  const id = `document-${kind}`;

  useEffect(() => onBusy(kind, state.step === "uploading"), [kind, state.step, onBusy]);
  // Leaving the page (or switching to Resale) cancels an upload that is still running.
  useEffect(() => () => abort.current?.abort(), []);

  async function pick(file: File | undefined) {
    if (!file) return;
    abort.current?.abort();
    const problem = checkDocument(kind, file);
    if (problem) {
      const error = problem === "badType" ? fmt(s.badDocType, { file: file.name, types: s.documentTypes[kind] }) : fmt(s.docTooLarge, { file: file.name, mb: MAX_DOCUMENT_MB });
      setState({ step: "empty", error });
      return;
    }
    const controller = (abort.current = new AbortController());
    setState({ step: "uploading", name: file.name, percent: 0 });
    try {
      const blob = await upload(documentPathname(kind, file.name), file, {
        access: "public",
        handleUploadUrl: "/api/documents",
        contentType: documentContentType(kind, file.name),
        abortSignal: controller.signal,
        onUploadProgress: ({ percentage }) => setState({ step: "uploading", name: file.name, percent: Math.round(percentage) }),
      });
      setState({ step: "done", name: file.name, size: file.size, url: blob.url });
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error("Document upload failed", err);
      setState({ step: "empty", error: fmt(s.uploadFailed, { file: file.name }) });
    }
  }

  function remove() {
    abort.current?.abort();
    setState({ step: "empty" });
  }

  return (
    <div>
      <label className="label" htmlFor={id}>
        {t.documentKind[kind]} <span className="font-normal text-cocoa">({s.documentTypes[kind]})</span>
      </label>
      <div className="flex min-h-14 items-center gap-3 rounded-xl border-2 border-dashed border-line bg-ivory px-4 py-3">
        {state.step === "empty" ? (
          <span className="text-sm text-cocoa">{s.noFile}</span>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" dir="auto" title={state.name}>
              {state.name}
            </p>
            {state.step === "uploading" ? (
              <div className="mt-1.5 flex items-center gap-2">
                <progress value={state.percent} max={100} aria-label={fmt(s.uploading, { percent: state.percent })} className="h-1.5 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-gold [&::-webkit-progress-bar]:bg-line [&::-webkit-progress-value]:bg-gold" />
                <span className="shrink-0 text-xs text-cocoa" dir="ltr">
                  {state.percent}%
                </span>
              </div>
            ) : (
              <p className="text-xs text-cocoa">
                <span className="text-success-deep">✓</span> {fmt(s.sizeMb, { n: sizeInMb(state.size) })}
              </p>
            )}
          </div>
        )}
        <span className={`flex shrink-0 items-center gap-2 ${state.step === "empty" ? "ms-auto" : ""}`}>
          <label className="btn-outline btn-sm cursor-pointer">
            {state.step === "empty" ? s.chooseFile : s.replaceFile}
            <input
              id={id}
              type="file"
              accept={acceptFor(kind)}
              className="sr-only"
              onChange={(e) => {
                pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {state.step !== "empty" && (
            <button
              type="button"
              onClick={remove}
              aria-label={fmt(s.removeFile, { name: state.name })}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-cocoa hover:bg-line hover:text-espresso"
            >
              ✕
            </button>
          )}
        </span>
      </div>
      {state.step === "empty" && state.error && (
        <p className="mt-1.5 text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state.step === "done" && (
        <>
          <input type="hidden" name={`${kind}Url`} value={state.url} />
          <input type="hidden" name={`${kind}Name`} value={state.name} />
        </>
      )}
    </div>
  );
}
