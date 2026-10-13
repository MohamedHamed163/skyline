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

/** Runs a server action and returns its result, or `fallback` if the request fails. Redirects still happen. */
export async function withFallback<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  let result = fallback;
  await succeeded(async () => {
    result = await run();
  });
  return result;
}

/** Wraps a server action for `useActionState`: a failed request becomes `{ ok: false, message }`. */
export function withFailureMessage<P>(action: (prev: FormState, payload: P) => Promise<FormState>, message: string) {
  return (prev: FormState, payload: P): Promise<FormState> => withFallback(() => action(prev, payload), { ok: false, message });
}
