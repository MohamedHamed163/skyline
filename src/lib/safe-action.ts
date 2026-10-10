import { unstable_rethrow } from "next/navigation";
import type { FormState } from "./types";

/**
 * Runs `run` and reports whether it finished. A failed request (network down, server crash,
 * timeout) is logged and returns false instead of throwing to the error boundary and wiping
 * the page. Next.js control flow (redirect, notFound) is re-thrown so it still works.
 */
export async function succeeded(run: () => Promise<unknown>): Promise<boolean> {
  try {
    await run();
    return true;
  } catch (err) {
    unstable_rethrow(err);
    console.error("Form submission failed", err);
    return false;
  }
}

/** Wraps a server action for `useActionState`: a failed request becomes `{ ok: false, message }`. */
export function withFailureMessage<P>(action: (prev: FormState, payload: P) => Promise<FormState>, message: string) {
  return async (prev: FormState, payload: P): Promise<FormState> => {
    let result: FormState = { ok: false, message };
    await succeeded(async () => {
      result = await action(prev, payload);
    });
    return result;
  };
}
