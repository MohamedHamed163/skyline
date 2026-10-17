"use client";

import { useState, useTransition } from "react";
import { CopyCode } from "@/components/copy-button";
import { resetHostPassword, type TemporaryPasswordResult } from "@/lib/actions";
import { fmt, useDict } from "@/lib/i18n/client";
import { withFallback } from "@/lib/safe-action";

// Admin: gives a host who forgot their password a temporary one (docs/host-accounts.md). It is
// shown here once, to pass on; the host is signed out everywhere and asked to choose their own.
export function HostPasswordReset({ hostId, username }: { hostId: string; username: string }) {
  const dict = useDict();
  const t = dict.admin.hostPassword;
  const [result, setResult] = useState<TemporaryPasswordResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-4 border-t border-line pt-3 text-sm">
      <p className="text-xs text-cocoa">{t.hint}</p>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(fmt(t.confirm, { username }))) return;
          startTransition(async () => setResult(await withFallback(() => resetHostPassword(hostId), { ok: false, message: dict.msg.actionFailed })));
        }}
        className="btn-outline btn-sm mt-2"
      >
        {pending ? t.working : t.button}
      </button>
      {result?.ok && (
        <div className="mt-3 rounded-lg bg-gold/15 p-3" role="status">
          <p className="font-medium">
            {fmt(t.done, { username })} <CopyCode code={result.password} />
          </p>
          <p className="mt-1 text-xs text-cocoa">{t.doneHint}</p>
        </div>
      )}
      {result && !result.ok && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {result.message}
        </p>
      )}
    </div>
  );
}
