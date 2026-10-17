"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { hostSignIn, hostSignUp } from "@/lib/actions";
import { PASSWORD_MAX, PASSWORD_MIN, USERNAME_MAX, USERNAME_MIN, USERNAME_PATTERN } from "@/lib/host-accounts";
import { fmt, useDict } from "@/lib/i18n/client";
import { withFailureMessage } from "@/lib/safe-action";

export type HostAuthMode = "signUp" | "signIn";

// The gate in front of /submit and /account (docs/host-accounts.md). First-time brokers and owners
// create an account (username, password, the password again); returning ones sign in. Each form
// links to the other. The username typed in one is carried over to the other.
export function HostAuthForm({ initialMode }: { initialMode: HostAuthMode }) {
  const t = useDict().account;
  const [mode, setMode] = useState(initialMode);
  const [username, setUsername] = useState("");
  const signUp = mode === "signUp";

  return (
    <div>
      <h2 className="text-2xl font-bold">{signUp ? t.signUpTitle : t.signInTitle}</h2>
      <p className="mt-2 text-sm text-cocoa">{signUp ? t.signUpSubtitle : t.signInSubtitle}</p>
      {/* Keyed so switching forms starts with a clean message and password fields. */}
      <AuthFields key={mode} mode={mode} username={username} onUsername={setUsername} />
      <p className="mt-6 border-t border-line pt-4 text-center text-sm text-cocoa">
        {signUp ? t.haveAccount : t.noAccount}{" "}
        <button type="button" onClick={() => setMode(signUp ? "signIn" : "signUp")} className="cursor-pointer font-semibold text-gold-deep hover:underline">
          {signUp ? t.toSignIn : t.toSignUp}
        </button>
      </p>
    </div>
  );
}

function AuthFields({ mode, username, onUsername }: { mode: HostAuthMode; username: string; onUsername: (v: string) => void }) {
  const dict = useDict();
  const t = dict.account;
  const signUp = mode === "signUp";
  const [state, action, pending] = useActionState(withFailureMessage(signUp ? hostSignUp : hostSignIn, dict.msg.requestFailed), null);
  const [, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = signUp && confirm.length > 0 && confirm !== password;
  const confirmRef = useRef<HTMLInputElement>(null);
  // Lets the browser stop the submit with the same message the server would send.
  useEffect(() => confirmRef.current?.setCustomValidity(mismatch ? t.errors.passwordMismatch : ""), [mismatch, t]);

  return (
    // onSubmit (not <form action>) so a failed attempt keeps what was typed.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="mt-6 space-y-4"
    >
      <div>
        <label className="label" htmlFor="username">
          {t.username}
        </label>
        <input
          id="username"
          name="username"
          required
          value={username}
          onChange={(e) => onUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          dir="ltr"
          {...(signUp && { minLength: USERNAME_MIN, maxLength: USERNAME_MAX, pattern: USERNAME_PATTERN, "aria-describedby": "username-hint" })}
          className="field"
        />
        {signUp && (
          <p id="username-hint" className="mt-1 text-xs text-cocoa">
            {fmt(t.usernameHint, { min: USERNAME_MIN, max: USERNAME_MAX })}
          </p>
        )}
      </div>
      <div>
        <label className="label" htmlFor="password">
          {t.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={signUp ? "new-password" : "current-password"}
          maxLength={PASSWORD_MAX}
          dir="ltr"
          {...(signUp && { minLength: PASSWORD_MIN, "aria-describedby": "password-hint" })}
          className="field"
        />
        {signUp && (
          <p id="password-hint" className="mt-1 text-xs text-cocoa">
            {fmt(t.passwordHint, { min: PASSWORD_MIN })}
          </p>
        )}
      </div>
      {signUp && (
        <div>
          <label className="label" htmlFor="confirmPassword">
            {t.confirmPassword}
          </label>
          <input
            id="confirmPassword"
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
            aria-describedby={mismatch ? "confirm-error" : undefined}
            className="field"
          />
          {mismatch && (
            <p id="confirm-error" className="mt-1 text-xs text-red-600">
              {t.errors.passwordMismatch}
            </p>
          )}
        </div>
      )}
      {state && !state.ok && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary w-full py-3">
        {signUp ? (pending ? t.creatingAccount : t.createAccount) : pending ? t.signingIn : t.signIn}
      </button>
    </form>
  );
}
