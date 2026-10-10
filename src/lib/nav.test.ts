import { describe, expect, it } from "vitest";
import { activeHref, isCurrentUrl } from "./nav";

const at = (url: string) => {
  const u = new URL(url, "http://x");
  return { pathname: u.pathname, search: u.searchParams };
};

const SITE = [
  "/properties",
  "/properties?listing=premium",
  "/properties?listing=resale",
  "/properties?purpose=rent",
  "/projects",
  "/about",
  "/contact",
];

const ADMIN = ["/admin", "/admin/properties", "/admin/properties?status=pending", "/admin/leads"];

describe("isCurrentUrl", () => {
  it("is true for the exact page", () => {
    expect(isCurrentUrl("/about", at("/about"))).toBe(true);
    expect(isCurrentUrl("/properties?listing=premium", at("/properties?listing=premium"))).toBe(true);
  });
  it("ignores query parameter order", () => {
    expect(isCurrentUrl("/properties?a=1&b=2", at("/properties?b=2&a=1"))).toBe(true);
  });
  it("is false for another page or extra filters", () => {
    expect(isCurrentUrl("/about", at("/contact"))).toBe(false);
    // Clicking "Properties" while filtered should still clear the filters.
    expect(isCurrentUrl("/properties", at("/properties?type=villa"))).toBe(false);
    expect(isCurrentUrl("/properties?listing=premium", at("/properties"))).toBe(false);
  });
});

describe("activeHref", () => {
  it("highlights the matching page", () => {
    expect(activeHref(SITE, at("/about"))).toBe("/about");
    expect(activeHref(SITE, at("/properties"))).toBe("/properties");
  });
  it("prefers the most specific match", () => {
    expect(activeHref(SITE, at("/properties?listing=premium"))).toBe("/properties?listing=premium");
    expect(activeHref(SITE, at("/properties?listing=premium&type=villa"))).toBe("/properties?listing=premium");
    expect(activeHref(SITE, at("/properties?type=villa"))).toBe("/properties");
  });
  it("highlights the section for nested pages", () => {
    expect(activeHref(SITE, at("/properties/SKY-PRM-0001"))).toBe("/properties");
    expect(activeHref(SITE, at("/projects/new-capital"))).toBe("/projects");
    expect(activeHref(ADMIN, at("/admin/properties/abc"))).toBe("/admin/properties");
  });
  it("does not let a parent path win over its child", () => {
    expect(activeHref(ADMIN, at("/admin/leads"))).toBe("/admin/leads");
    expect(activeHref(ADMIN, at("/admin"))).toBe("/admin");
    expect(activeHref(ADMIN, at("/admin/properties?status=pending"))).toBe("/admin/properties?status=pending");
  });
  it("does not match on a shared name prefix", () => {
    expect(activeHref(["/pro"], at("/projects"))).toBe(null);
  });
  it("returns null when nothing matches", () => {
    expect(activeHref(SITE, at("/"))).toBe(null);
    expect(activeHref(SITE, at("/submit"))).toBe(null);
  });
});
