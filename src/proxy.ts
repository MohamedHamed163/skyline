import { NextResponse, type NextRequest } from "next/server";
import { bucketFor, clientIp, LIMITS, limiter, type HitResult } from "@/lib/rate-limit";

// 1. Per-IP rate limiting (src/lib/rate-limit.ts, docs/rate-limiting.md).
// 2. Splits one deployment across two domains:
//   - ADMIN_HOST serves only the admin dashboard (/admin/…)
//   - every other host serves only the public website
// When ADMIN_HOST is unset (local development) both live on the same host.

export function proxy(request: NextRequest) {
  const bucket = bucketFor(request.method, request.headers);
  const hit = limiter.hit(`${bucket}:${clientIp(request.headers)}`, LIMITS[bucket]);
  if (!hit.ok) return tooManyRequests(hit);

  const adminHost = process.env.ADMIN_HOST;
  if (!adminHost) return NextResponse.next();

  const { pathname } = request.nextUrl;
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const onAdminHost = request.headers.get("host") === adminHost;

  if (onAdminHost && !isAdminPath) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }
  if (!onAdminHost && isAdminPath) {
    // The dashboard does not exist on the public domain: show the normal 404 page.
    return NextResponse.rewrite(new URL("/404", request.url), { status: 404 });
  }
  return NextResponse.next();
}

function tooManyRequests(hit: HitResult) {
  const retryAfter = String(Math.ceil(hit.resetMs / 1000));
  return new NextResponse("Too many requests. Please wait a moment and try again.", {
    status: 429,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Retry-After": retryAfter,
      "RateLimit-Limit": String(hit.limit),
      "RateLimit-Remaining": "0",
      "RateLimit-Reset": retryAfter,
    },
  });
}

export const config = {
  matcher: ["/((?!_next/|brand/|listings/|icon.png|favicon.ico).*)"],
};
