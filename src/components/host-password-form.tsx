"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { changeHostPassword } from "@/lib/actions";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/host-accounts";
import { fmt, useDict } from "@/lib/i18n/client";
import { withFailureMessage } from "@/lib/safe-action";
import type { FormState } from "@/lib/types";

// Change password on /account (docs/host-accounts.md): the current password, then the new one twice.
// The server signs the account's other sessions out and keeps this one signed in.
export function HostPasswordForm({ username }: { username: string }) {
  const dict = useDict();
  const t = dict.account;
  const form = useRef<HTMLFormElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [, startTransition] = useTransition();
  const save = withFailureMessage(changeHostPassword, dict.msg.requestFailed);
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const result = await save(prev, fd);
    if (result?.ok) {
      form.current?.reset();
      setPassword("");
      setConfirm("");
    }
    return result;
  }, null);
  const mismatch = confirm.length > 0 && confirm !== password;
  // Lets the browser stop the submit with the same message the server would send.
  useEffect(() => confirmRef.current?.setCustomValidity(mismatch ? t.errors.passwordMismatch : ""), [mismatch, t]);

  return (
    // onSubmit (not <form action>) so a failed attempt keeps what was typed.
    <form
      ref={form}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="mt-4 space-y-4"
    >
      {/* Tells password managers which account the new password is for. */}
      <input type="text" name="username" value={username} autoComplete="username" readOnly hidden />
      <div>
        <label className="label" htmlFor="current-password">
          {t.currentPassword}
        </label>
        <input id="current-password" name="currentPassword" type="password" required autoComplete="current-password" maxLength={PASSWORD_MAX} dir="ltr" className="field" />
      </div>
      <div>
        <label className="label" htmlFor="new-password">
          {t.newPassword}
        </label>
        <input
          id="new-password"
          name="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
          dir="ltr"
          aria-describedby="new-password-hint"
          className="field"
        />
        <p id="new-password-hint" className="mt-1 text-xs text-cocoa">
          {fmt(t.passwordHint, { min: PASSWORD_MIN })}
        </p>
      </div>
      <div>
        <label className="label" htmlFor="confirm-new-password">
          {t.confirmNewPassword}
        </label>
        <input
          id="confirm-new-password"
          name="confirmPassword"
          type="password"
          required
          ref={confirmRef}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          maxLength={PASSWORD_MAX}
          dir="ltr"
          aria-invalid={mismatch || undefined}
          aria-describedby={mismatch ? "confirm-new-password-error" : undefined}
          className="field"
        />
        {mismatch && (
          <p id="confirm-new-password-error" className="mt-1 text-xs text-red-600">
            {t.errors.passwordMismatch}
          </p>
        )}
      </div>
      {state && (
        <p className={`rounded-xl px-4 py-3 text-sm ${state.ok ? "bg-success/10 text-success-deep" : "bg-red-50 text-red-700"}`} role={state.ok ? "status" : "alert"}>
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? t.changingPassword : t.changePassword}
      </button>
    </form>
  );
}
