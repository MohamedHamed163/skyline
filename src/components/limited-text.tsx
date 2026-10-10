"use client";

import { useState } from "react";
import { fmt, useDict } from "@/lib/i18n/client";
import { counterTone } from "@/lib/validation";

const TONES = { normal: "text-cocoa", near: "text-amber-700", full: "text-red-600 font-semibold" };

/**
 * Text input or textarea capped at `max` characters (the browser stops typing and trims pastes
 * at the limit), with a live "45 / 120" counter under it that turns amber near the limit and red
 * at it.
 */
export function LimitedText({
  id,
  name,
  max,
  multiline = false,
  defaultValue = "",
  ...rest
}: {
  id: string;
  name: string;
  max: number;
  multiline?: boolean;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  rows?: number;
}) {
  const t = useDict().fields;
  const [value, setValue] = useState(defaultValue);
  const tone = counterTone(value.length, max);
  const counterId = `${id}-count`;
  const props = {
    id,
    name,
    maxLength: max,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValue(e.target.value),
    "aria-describedby": counterId,
    className: "field",
    ...rest,
  };

  return (
    <>
      {multiline ? <textarea {...props} /> : <input {...props} />}
      <p id={counterId} className={`mt-1 text-end text-xs tabular-nums ${TONES[tone]}`}>
        <span aria-hidden="true" dir="ltr">
          {value.length.toLocaleString("en-US")} / {max.toLocaleString("en-US")}
        </span>
        <span className="sr-only">{fmt(t.charsLeft, { n: (max - value.length).toLocaleString("en-US"), max: max.toLocaleString("en-US") })}</span>
      </p>
    </>
  );
}
