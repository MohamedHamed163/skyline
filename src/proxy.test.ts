import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { LIMITS, limiter } from "@/lib/rate-limit";
import { proxy } from "./proxy";

let ip = 0;
let currentIp = "";

function request(path: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  return new NextRequest(new URL(path, "http://localhost:3000"), {
    method: init.method,
    headers: { "x-forwarded-for": currentIp, ...init.headers },
  });
}

describe("proxy rate limiting", () => {
  beforeEach(() => {
    currentIp = `10.0.0.${++ip}`; // fresh IP per test, the limiter is shared
  });

  it("passes requests under the limit", () => {
    const res = proxy(request("/about"));
    expect(res.status).toBe(200);
  });

  it("returns 429 with Retry-After once an IP exceeds the page limit", () => {
    for (let i = 0; i < LIMITS.page.max; i++) expect(proxy(request("/about")).status).toBe(200);
    const res = proxy(request("/about"));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(res.headers.get("RateLimit-Remaining")).toBe("0");
  });

  it("does not punish other IPs", () => {
    for (let i = 0; i <= LIMITS.page.max; i++) proxy(request("/about"));
    currentIp = "10.9.9.9";
    expect(proxy(request("/about")).status).toBe(200);
    limiter.reset("page:10.9.9.9");
  });

  it("limits form submissions more tightly than page loads", () => {
    for (let i = 0; i < LIMITS.action.max; i++) proxy(request("/contact", { method: "POST" }));
    expect(proxy(request("/contact", { method: "POST" })).status).toBe(429);
    // Browsing still works for the same IP.
    expect(proxy(request("/contact")).status).toBe(200);
  });

  it("counts prefetches in their own bucket", () => {
    const prefetch = { headers: { "next-router-prefetch": "1" } };
    for (let i = 0; i < LIMITS.page.max + 10; i++) expect(proxy(request("/about", prefetch)).status).toBe(200);
    expect(proxy(request("/about")).status).toBe(200);
  });
});
