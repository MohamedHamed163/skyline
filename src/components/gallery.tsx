"use client";

import { useEffect, useState } from "react";
import { ChevronIcon, CloseIcon, PhotoIcon } from "@/components/icons";
import { fmt, useDict } from "@/lib/i18n/client";

// Property gallery: cover + thumbnails, click opens a full-screen lightbox.
export function Gallery({ photos, title }: { photos: string[]; title: string }) {
  const t = useDict();
  const [open, setOpen] = useState<number | null>(null);
  const count = photos.length;

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : (i + 1) % count));
      if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : (i - 1 + count) % count));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, count]);

  const [cover, ...rest] = photos;
  const side = rest.slice(0, 2);

  return (
    <>
      <div className={`grid gap-2 overflow-hidden rounded-2xl ${side.length ? "md:grid-cols-3" : ""}`}>
        <button type="button" onClick={() => setOpen(0)} className={`relative block cursor-pointer bg-line ${side.length ? "md:col-span-2" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt={title} className={`w-full object-cover ${side.length ? "aspect-[4/3] md:aspect-[16/10] md:h-full" : "aspect-[4/3] sm:aspect-[21/9]"}`} />
          <span className="absolute bottom-3 start-3 flex items-center gap-1.5 rounded-full bg-espresso/75 px-3 py-1.5 text-xs font-semibold text-cream backdrop-blur">
            <PhotoIcon /> {fmt(t.property.allPhotos, { n: count })}
          </span>
        </button>
        {side.length > 0 && (
          <div className="hidden gap-2 md:grid md:grid-cols-1">
            {side.map((src, i) => (
              <button key={i} type="button" onClick={() => setOpen(i + 1)} className="relative block aspect-[4/3] cursor-pointer overflow-hidden bg-line md:aspect-auto md:h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={fmt(t.property.photoN, { title, n: i + 2 })} className="h-full w-full object-cover" />
                {i === 1 && count > 3 && (
                  <span className="absolute inset-0 flex items-center justify-center bg-espresso/60 text-lg font-bold text-cream">+{count - 3}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {open !== null && (
        <div className="fixed inset-0 z-50 flex flex-col bg-deep/95 text-cream" role="dialog" aria-modal="true" onClick={() => setOpen(null)}>
          <div className="flex items-center justify-between px-4 py-3 text-sm" dir="ltr">
            <span>
              {open + 1} / {count}
            </span>
            <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="cursor-pointer rounded-full p-2 hover:bg-white/10">
              <CloseIcon className="h-6 w-6" />
            </button>
          </div>
          <div className="relative flex flex-1 items-center justify-center px-12" onClick={(e) => e.stopPropagation()} dir="ltr">
            <button type="button" onClick={() => setOpen((open - 1 + count) % count)} aria-label="Previous" className="absolute left-2 cursor-pointer rounded-full bg-white/10 p-2 hover:bg-white/20">
              <ChevronIcon className="h-6 w-6 rotate-180" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[open]} alt={fmt(t.property.photoN, { title, n: open + 1 })} className="max-h-[80vh] max-w-full rounded-xl object-contain" />
            <button type="button" onClick={() => setOpen((open + 1) % count)} aria-label="Next" className="absolute right-2 cursor-pointer rounded-full bg-white/10 p-2 hover:bg-white/20">
              <ChevronIcon className="h-6 w-6" />
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto px-4 py-3" onClick={(e) => e.stopPropagation()} dir="ltr">
            {photos.map((src, i) => (
              <button key={i} type="button" onClick={() => setOpen(i)} className={`h-14 w-20 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 ${i === open ? "border-gold" : "border-transparent opacity-60 hover:opacity-100"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
