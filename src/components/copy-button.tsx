"use client";

import { useState } from "react";
import { useDict } from "@/lib/i18n/client";

// Shows the property code and copies it with one click.
export function CopyCode({ code }: { code: string }) {
  const t = useDict();
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      title={t.copy}
      onClick={async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-line bg-ivory px-2 py-0.5 font-mono text-xs font-semibold hover:border-gold hover:text-gold-deep"
    >
      <span dir="ltr">{code}</span>
      <span aria-live="polite" className={`font-sans font-medium ${copied ? "text-success-deep" : "text-cocoa"}`}>
        {copied ? t.copied : t.copy}
      </span>
    </button>
  );
}
