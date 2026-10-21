"use client";

import { useTransition } from "react";
import { dismissPasswordRequest } from "@/lib/actions";
import { useDict } from "@/lib/i18n/client";

// Admin: closes a forgot-password request without changing a password (docs/password-help.md).
export function PasswordRequestDismiss({ id }: { id: string }) {
  const t = useDict().admin.accounts;
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(t.dismissConfirm)) return;
        startTransition(() => dismissPasswordRequest(id));
      }}
      className="cursor-pointer text-xs font-semibold text-cocoa hover:text-error hover:underline"
    >
      {t.dismiss}
    </button>
  );
}
