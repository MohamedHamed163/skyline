import { describe, expect, it } from "vitest";
import { bucketFor, clientIp, RateLimiter } from "./rate-limit";

function clock(start = 0) {
  const c = { t: start, now: () => c.t };
  return c;
}

const LIMIT = { max: 3, windowMs: 1000 };

describe("RateLimiter", () => {
  it("allows up to max hits per window, then blocks", () => {
    const limiter = new RateLimiter(100, clock().now);
    expect([1, 2, 3].map(() => limiter.hit("ip", LIMIT).ok)).toEqual([true, true, true]);
    const blocked = limiter.hit("ip", LIMIT);
    expect(blocked).toMatchObject({ ok: false, remaining: 0, limit: 3 });
  });

  it("reports remaining hits and time to reset", () => {
    const c = clock();
    const limiter = new RateLimiter(100, c.now);
    expect(limiter.hit("ip", LIMIT)).toEqual({ ok: true, limit: 3, remaining: 2, resetMs: 1000 });
    c.t = 400;
    expect(limiter.hit("ip", LIMIT)).toMatchObject({ remaining: 1, resetMs: 600 });
  });

  it("starts a fresh window once the old one expires", () => {
    const c = clock();
    const limiter = new RateLimiter(100, c.now);
    for (let i = 0; i < 5; i++) limiter.hit("ip", LIMIT);
    expect(limiter.hit("ip", LIMIT).ok).toBe(false);
    c.t = 1000;
    expect(limiter.hit("ip", LIMIT)).toMatchObject({ ok: true, remaining: 2 });
  });

  it("counts each key separately", () => {
    const limiter = new RateLimiter(100, clock().now);
    for (let i = 0; i < 3; i++) limiter.hit("a", LIMIT);
    expect(limiter.hit("a", LIMIT).ok).toBe(false);
    expect(limiter.hit("b", LIMIT).ok).toBe(true);
  });

  it("reset() clears a key", () => {
    const limiter = new RateLimiter(100, clock().now);
    for (let i = 0; i < 4; i++) limiter.hit("ip", LIMIT);
    limiter.reset("ip");
    expect(limiter.hit("ip", LIMIT).ok).toBe(true);
  });

  it("stays within maxKeys under a flood of distinct keys", () => {
    const c = clock();
    const limiter = new RateLimiter(50, c.now);
    for (let i = 0; i < 1000; i++) limiter.hit(`ip-${i}`, LIMIT);
    expect(limiter.size).toBeLessThanOrEqual(50);
  });

  it("prunes expired windows before evicting live ones", () => {
    const c = clock();
    const limiter = new RateLimiter(3, c.now);
    limiter.hit("old-1", LIMIT);
    limiter.hit("old-2", LIMIT);
    c.t = 500;
    limiter.hit("live", { max: 3, windowMs: 10_000 });
    c.t = 2000; // old-1 and old-2 have expired, "live" has not
    limiter.hit("new", LIMIT);
    for (let i = 0; i < 3; i++) limiter.hit("live", { max: 3, windowMs: 10_000 });
    expect(limiter.hit("live", { max: 3, windowMs: 10_000 }).ok).toBe(false);
    expect(limiter.size).toBe(2);
  });
});

describe("clientIp", () => {
  it("uses the first x-forwarded-for entry", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
  });
  it("falls back to x-real-ip, then 'unknown'", () => {
    expect(clientIp(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("bucketFor", () => {
  it("separates page loads, prefetches and actions", () => {
    expect(bucketFor("GET", new Headers())).toBe("page");
    expect(bucketFor("HEAD", new Headers())).toBe("page");
    expect(bucketFor("GET", new Headers({ "next-router-prefetch": "1" }))).toBe("prefetch");
    expect(bucketFor("POST", new Headers())).toBe("action");
    expect(bucketFor("POST", new Headers({ "next-router-prefetch": "1" }))).toBe("action");
  });
});
