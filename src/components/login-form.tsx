"use client";

import { useActionState, useTransition } from "react";
import { adminLogin } from "@/lib/actions";
import { useDict } from "@/lib/i18n/client";
import { withFailureMessage } from "@/lib/safe-action";

export function LoginForm() {
  const dict = useDict();
  const t = dict.admin;
  const [state, action, pending] = useActionState(withFailureMessage(adminLogin, dict.msg.requestFailed), null);
  const [, startTransition] = useTransition();

  return (
    // onSubmit (not <form action>) so a failed attempt doesn't clear the field.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="space-y-4"
    >
      <div>
        <label className="label" htmlFor="password">
          {t.password}
        </label>
        <input id="password" name="password" type="password" required autoComplete="current-password" dir="ltr" className="field" />
      </div>
      {state && !state.ok && (
        <p className="text-sm text-red-600" role="alert">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? t.signingIn : t.signIn}
      </button>
    </form>
  );
}
