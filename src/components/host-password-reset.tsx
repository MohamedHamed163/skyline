"use client";

import { useState, useTransition } from "react";
import { CopyCode } from "@/components/copy-button";
import { resetHostPassword, type TemporaryPasswordResult } from "@/lib/actions";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/host-accounts";
import { fmt, useDict } from "@/lib/i18n/client";
import { withFallback } from "@/lib/safe-action";

// Admin: gives a host who forgot their password a new one (docs/host-accounts.md,
// docs/password-help.md): generated, or typed by the admin. It is shown here once, to pass on; the
// host is signed out everywhere and asked to choose their own.
export function HostPasswordReset({ hostId, username, bare = false }: { hostId: string; username: string; bare?: boolean }) {
  const dict = useDict();
  const t = dict.admin.hostPassword;
  const [result, setResult] = useState<TemporaryPasswordResult | null>(null);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();

  const reset = (chosen?: string) => {
    if (!window.confirm(fmt(chosen === undefined ? t.confirm : t.confirmTyped, { username }))) return;
    startTransition(async () => {
      const r = await withFallback(() => resetHostPassword(hostId, chosen), { ok: false as const, message: dict.msg.actionFailed });
      setResult(r);
      if (r.ok) setTyped("");
    });
  };

  return (
    <div className={bare ? "text-sm" : "mt-4 border-t border-line pt-3 text-sm"}>
      {!bare && <p className="text-xs text-cocoa">{t.hint}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" disabled={pending} onClick={() => reset()} className="btn-outline btn-sm">
          {pending ? t.working : t.button}
        </button>
        {!typing && (
          <button type="button" onClick={() => setTyping(true)} className="cursor-pointer text-xs font-semibold text-gold-deep hover:underline">
            {t.typeOwn}
          </button>
        )}
      </div>
      {typing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            reset(typed);
          }}
          className="mt-3 flex flex-wrap items-end gap-2"
        >
          <label className="min-w-48 flex-1">
            <span className="text-xs text-cocoa">{fmt(t.typedLabel, { username })}</span>
            {/* Plain text: the admin reads it out to the host. */}
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              required
              minLength={PASSWORD_MIN}
              maxLength={PASSWORD_MAX}
              autoComplete="off"
              spellCheck={false}
              dir="ltr"
              className="field mt-1"
            />
          </label>
          <button type="submit" disabled={pending} className="btn-outline btn-sm">
            {t.setTyped}
          </button>
        </form>
      )}
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
