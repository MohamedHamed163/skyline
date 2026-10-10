import { NextResponse, type NextRequest } from "next/server";

// Splits one deployment across two domains:
//   - ADMIN_HOST serves only the admin dashboard (/admin/…)
//   - every other host serves only the public website
// When ADMIN_HOST is unset (local development) both live on the same host.

export function proxy(request: NextRequest) {
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

export const config = {
  matcher: ["/((?!_next/|brand/|listings/|icon.png|favicon.ico).*)"],
};
