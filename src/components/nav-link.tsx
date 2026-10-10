"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { activeHref, isCurrentUrl } from "@/lib/nav";

function useCurrent() {
  return { pathname: usePathname(), search: new URLSearchParams(useSearchParams()) };
}

/**
 * A link that does nothing when it points at the page already open, so repeated clicks
 * don't refetch it. Ctrl/Cmd/Shift/middle clicks still open new tabs as usual.
 */
export function NavLink({ href, onClick, ...props }: React.ComponentProps<typeof Link> & { href: string }) {
  const current = useCurrent();
  return (
    <Link
      href={href}
      onClick={(e) => {
        const plainClick = e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
        if (plainClick && isCurrentUrl(href, current)) e.preventDefault();
        onClick?.(e);
      }}
      {...props}
    />
  );
}

/** A menu of NavLinks where the item for the current page is highlighted and marked aria-current. */
export function NavMenu({
  items,
  className,
  activeClassName,
}: {
  items: readonly { href: string; label: React.ReactNode }[];
  className: string;
  activeClassName: string;
}) {
  const active = activeHref(
    items.map((i) => i.href),
    useCurrent(),
  );
  return items.map(({ href, label }) => (
    <NavLink
      key={href}
      href={href}
      aria-current={href === active ? "page" : undefined}
      className={`${className} ${href === active ? activeClassName : ""}`}
    >
      {label}
    </NavLink>
  ));
}
