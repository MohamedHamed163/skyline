"use client";

import { useTransition } from "react";
import { impersonateHost } from "@/lib/actions";
import { fmt, useDict } from "@/lib/i18n/client";

// Admin: enter a host's account to support them (docs/host-impersonation.md). The action redirects to
// /account with the host's session set alongside the admin cookie; ImpersonationBanner shows there and
// offers the way out. Every entry is logged.
export function HostImpersonate({ hostId, username }: { hostId: string; username: string }) {
  const t = useDict().admin.impersonate;
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-4 border-t border-line pt-3 text-sm">
      <p className="text-xs text-cocoa">{t.hint}</p>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(fmt(t.confirm, { username }))) return;
          startTransition(() => impersonateHost(hostId));
        }}
        className="btn-outline btn-sm mt-2"
      >
        {pending ? t.working : t.button}
      </button>
    </div>
  );
}
