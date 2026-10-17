// Per-IP request limits. Fixed window counters held in memory.
//
// The counters live in one server instance, so on Vercel each instance counts on its
// own and they reset on a cold start. That stops a single script hammering the app, but
// it is not a full DoS shield. Pair it with a Vercel Firewall rate-limit rule (see
// docs/rate-limiting.md). To share counters across instances, replace the Map with a
// shared store (e.g. Upstash Redis) behind the same `hit` API.

export type Limit = { max: number; windowMs: number };

export type HitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Milliseconds until the window resets. */
  resetMs: number;
};

type Window = { count: number; resetAt: number };

export class RateLimiter {
  private windows = new Map<string, Window>();

  constructor(
    /** Upper bound on tracked keys, so a flood of spoofed IPs can't exhaust memory. */
    private maxKeys = 10_000,
    private now: () => number = Date.now,
  ) {}

  /** Counts one request for `key` and says whether it is within `limit`. */
  hit(key: string, { max, windowMs }: Limit): HitResult {
    const now = this.now();
    let w = this.windows.get(key);
    if (!w || w.resetAt <= now) {
      if (!w && this.windows.size >= this.maxKeys) this.prune(now);
      w = { count: 0, resetAt: now + windowMs };
      this.windows.set(key, w);
    }
    w.count++;
    return { ok: w.count <= max, limit: max, remaining: Math.max(0, max - w.count), resetMs: w.resetAt - now };
  }

  /** Forgets `key`, e.g. after a successful login. */
  reset(key: string) {
    this.windows.delete(key);
  }

  get size() {
    return this.windows.size;
  }

  private prune(now: number) {
    for (const [key, w] of this.windows) if (w.resetAt <= now) this.windows.delete(key);
    // Still full of live windows: drop the oldest entries (Map keeps insertion order).
    for (const key of this.windows.keys()) {
      if (this.windows.size < this.maxKeys) break;
      this.windows.delete(key);
    }
  }
}

/**
 * The caller's IP. Vercel (and most reverse proxies) overwrite x-forwarded-for with the
 * real client address first, so the first entry is trustworthy there. Without a proxy in
 * front, clients can forge this header — deploy behind one.
 */
export function clientIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

const MINUTE = 60_000;

/** Limits applied by src/proxy.ts, per IP and per bucket. */
export const LIMITS = {
  /** Page loads and client navigations. */
  page: { max: 120, windowMs: MINUTE },
  /** Link prefetches: a page with many cards prefetches many links at once. */
  prefetch: { max: 600, windowMs: MINUTE },
  /** Form submissions / server actions (anything that isn't GET or HEAD). */
  action: { max: 30, windowMs: MINUTE },
  /**
   * Admin password attempts, and host sign-in attempts counted separately (checked in the actions).
   * Host password changes use it too, counted per account.
   */
  login: { max: 5, windowMs: 15 * MINUTE },
  /** New host accounts (checked in the sign-up action itself). */
  signUp: { max: 5, windowMs: 60 * MINUTE },
  /** Primary-listing document uploads (checked in /api/documents itself). */
  documentUpload: { max: 10, windowMs: 10 * MINUTE },
} satisfies Record<string, Limit>;

export type Bucket = Exclude<keyof typeof LIMITS, "login" | "signUp" | "documentUpload">;

export function bucketFor(method: string, headers: Headers): Bucket {
  if (method !== "GET" && method !== "HEAD") return "action";
  return headers.get("next-router-prefetch") ? "prefetch" : "page";
}

// One limiter per server instance, shared by the proxy and server actions.
const g = globalThis as { __skylineLimiter?: RateLimiter };
export const limiter = (g.__skylineLimiter ??= new RateLimiter());
