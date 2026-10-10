"use client";

import { useActionState } from "react";
import { adminLogin } from "@/lib/actions";
import { useDict } from "@/lib/i18n/client";

export function LoginForm() {
  const t = useDict().admin;
  const [state, action, pending] = useActionState(adminLogin, null);

  return (
    <form action={action} className="space-y-4">
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
