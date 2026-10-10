"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { fmt, useDict } from "@/lib/i18n/client";
import { checkWholeNumber, caretAfterDigits, digitsOnly, groupDigits, maxDigits, type NumberLimits } from "@/lib/validation";

/**
 * Whole-number text field (not <input type="number">): accepts digits only, Arabic digits
 * included, and can't take more digits than `limits.max` has. The value is checked against
 * `limits` as the user types and the error is shown under the field. The browser also blocks
 * submission while it is invalid. With `grouped`, the value is shown as 1,000,000; the form
 * still receives plain digits through a hidden input named `name`.
 */
export function NumberField({
  id,
  name,
  limits,
  required = true,
  grouped = false,
  defaultValue,
}: {
  id: string;
  name: string;
  limits: NumberLimits;
  required?: boolean;
  grouped?: boolean;
  defaultValue?: number;
}) {
  const t = useDict().fields.errors;
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const [digits, setDigits] = useState(defaultValue === undefined ? "" : String(defaultValue));
  const [touched, setTouched] = useState(false);

  const error = checkWholeNumber(digits, limits, required);
  const message = error ? fmt(t[error], { min: groupDigits(String(limits.min)), max: groupDigits(String(limits.max)) }) : "";
  const shown = grouped ? groupDigits(digits) : digits;

  // Native validity, so the browser stops the submit and focuses this field while it's invalid.
  useEffect(() => ref.current?.setCustomValidity(message), [message]);

  // Re-place the caret after commas are added or removed.
  useLayoutEffect(() => {
    if (caret.current === null || !ref.current) return;
    const pos = caretAfterDigits(shown, caret.current);
    ref.current.setSelectionRange(pos, pos);
    caret.current = null;
  }, [shown]);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    let next = digitsOnly(input.value);
    setTouched(true);
    if (next.length > maxDigits(limits)) {
      if (digits.length >= maxDigits(limits)) return; // already full: ignore the extra keystroke
      next = next.slice(0, maxDigits(limits)); // a long paste: keep what fits
    }
    caret.current = digitsOnly(input.value.slice(0, input.selectionStart ?? input.value.length)).length;
    setDigits(next);
  }

  const errorId = `${id}-error`;
  const invalid = touched && Boolean(error);
  return (
    <>
      <input
        ref={ref}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        dir="ltr"
        value={shown}
        onChange={onChange}
        onBlur={() => setTouched(true)}
        onInvalid={() => setTouched(true)}
        aria-required={required}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        className="field"
      />
      <input type="hidden" name={name} value={digits} />
      {invalid && (
        <p id={errorId} className="mt-1 text-xs text-red-600">
          {message}
        </p>
      )}
    </>
  );
}
