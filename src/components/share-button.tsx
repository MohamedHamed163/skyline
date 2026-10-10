"use client";

import { useState } from "react";
import { ShareIcon } from "@/components/icons";
import { useDict } from "@/lib/i18n/client";

export function ShareButton() {
  const t = useDict().property;
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(window.location.href);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="btn-outline btn-sm"
    >
      <ShareIcon /> {done ? t.shared : t.share}
    </button>
  );
}
