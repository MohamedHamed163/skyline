import { unstable_rethrow } from "next/navigation";
import type { FormState } from "./types";

/**
 * Wraps a server action for `useActionState` so a failed request (network down, server crash,
 * timeout) becomes an error message instead of throwing to the error boundary and wiping the page.
 * Next.js control flow (redirect, notFound) is re-thrown so it still works.
 */
export function withFailureMessage<P>(action: (prev: FormState, payload: P) => Promise<FormState>, message: string) {
  return async (prev: FormState, payload: P): Promise<FormState> => {
    try {
      return await action(prev, payload);
    } catch (err) {
      unstable_rethrow(err);
      console.error("Form submission failed", err);
      return { ok: false, message };
    }
  };
}
