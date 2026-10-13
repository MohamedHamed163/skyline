"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { fmt, useDict } from "@/lib/i18n/client";
import { checkWholeNumber, caretAfterDigits, digitsOnly, groupDigits, maxDigits, type NumberLimits } from "@/lib/validation";

/**
 * Typing state for a whole-number text field: keeps digits only (Arabic digits are converted), never
 * more than `limits.max` has, shown as 1,000,000 when `grouped`, with the caret kept in place as
 * commas come and go. `onValue` hears every change. Spread `ref`, `value: shown` and `onChange` on
 * the input.
 */
export function useDigits(initial: string, limits: NumberLimits, grouped: boolean, onValue?: (digits: string) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const [digits, setDigits] = useState(initial);
  const shown = grouped ? groupDigits(digits) : digits;

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
    if (next.length > maxDigits(limits)) {
      if (digits.length >= maxDigits(limits)) return; // already full: ignore the extra keystroke
      next = next.slice(0, maxDigits(limits)); // a long paste: keep what fits
    }
    caret.current = digitsOnly(input.value.slice(0, input.selectionStart ?? input.value.length)).length;
    setDigits(next);
    onValue?.(next);
  }

  return { ref, digits, setDigits, shown, onChange };
}

/**
 * Whole-number text field (not <input type="number">): accepts digits only, Arabic digits
 * included, and can't take more digits than `limits.max` has. The value is checked against
 * `limits` as the user types and the error is shown under the field. The browser also blocks
 * submission while it is invalid. With `grouped`, the value is shown as 1,000,000; the form
 * still receives plain digits through a hidden input named `name`. `onValueChange` hears each edit.
 */
export function NumberField({
  id,
  name,
  limits,
  required = true,
  grouped = false,
  defaultValue,
  placeholder,
  onValueChange,
}: {
  id: string;
  name: string;
  limits: NumberLimits;
  required?: boolean;
  grouped?: boolean;
  defaultValue?: number;
  placeholder?: string;
  onValueChange?: (digits: string) => void;
}) {
  const t = useDict().fields.errors;
  const { ref, digits, shown, onChange } = useDigits(defaultValue === undefined ? "" : String(defaultValue), limits, grouped, onValueChange);
  const [touched, setTouched] = useState(false);

  const error = checkWholeNumber(digits, limits, required);
  const message = error ? fmt(t[error], { min: groupDigits(String(limits.min)), max: groupDigits(String(limits.max)) }) : "";

  // Native validity, so the browser stops the submit and focuses this field while it's invalid.
  useEffect(() => ref.current?.setCustomValidity(message), [ref, message]);

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
        placeholder={placeholder}
        onChange={(e) => {
          setTouched(true);
          onChange(e);
        }}
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
