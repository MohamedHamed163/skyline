"use client";

import { useState, useTransition } from "react";
import { useDict } from "@/lib/i18n/client";
import { succeeded } from "@/lib/safe-action";

/**
 * <form> for one-click server actions that return nothing (status buttons, notes, logout,
 * language switch). Unlike <form action>, it doesn't reset what was typed, and a failed request
 * shows an inline error instead of crashing the page. Controls are disabled while it runs.
 * `confirm` asks first and cancels on "no".
 */
export function ActionForm({
  action,
  confirm,
  className,
  errorClassName = "text-red-600",
  children,
}: {
  action: (fd: FormData) => Promise<unknown>;
  confirm?: string;
  className?: string;
  errorClassName?: string;
  children: React.ReactNode;
}) {
  const t = useDict().msg;
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  return (
    <form
      className={className}
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        // Pass the submitter so a clicked button's name/value (e.g. the language switch) is sent.
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        setFailed(false);
        startTransition(async () => {
          const ok = await succeeded(() => action(fd));
          if (!ok) setFailed(true);
        });
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {failed && (
        <p className={`mt-1 text-xs ${errorClassName}`} role="alert">
          {t.actionFailed}
        </p>
      )}
    </form>
  );
}
