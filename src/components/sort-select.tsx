"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ChevronIcon } from "@/components/icons";
import type { Sort } from "@/lib/search";

/**
 * Sort dropdown for /properties that applies on change. `hrefs` (built server-side with
 * `sortHrefs`) keep every active filter and reset to page 1. While the new results load, the
 * select is disabled, shows a spinner and carries `data-pending` so the page can dim its results.
 */
export function SortSelect({ label, value, options, hrefs }: { label: string; value: Sort; options: { value: Sort; label: string }[]; hrefs: Record<Sort, string> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2 text-sm" data-pending={pending || undefined} aria-busy={pending}>
      <label htmlFor="sort" className="text-cocoa">
        {label}
      </label>
      <div className="relative">
        <select
          id="sort"
          value={value}
          disabled={pending}
          onChange={(e) => startTransition(() => router.push(hrefs[e.target.value as Sort], { scroll: false }))}
          className="field w-auto cursor-pointer appearance-none bg-none py-1.5 pe-9 [field-sizing:content] disabled:cursor-wait disabled:opacity-70"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-cocoa">
          {pending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-cocoa/30 border-t-espresso" /> : <ChevronIcon className="rotate-90" />}
        </span>
      </div>
    </div>
  );
}
