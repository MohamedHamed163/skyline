import Image from "next/image";
import { UserIcon } from "@/components/icons";
import { LanguageSwitch } from "@/components/language-switch";
import { NavLink, NavMenu } from "@/components/nav-link";
import { currentHostId } from "@/lib/host-auth";
import { getDict } from "@/lib/i18n";

export function Logo({ href = "/", className = "", imageClassName = "h-10" }: { href?: string; className?: string; imageClassName?: string }) {
  return (
    <NavLink href={href} className={`inline-flex shrink-0 items-center ${className}`}>
      <Image src="/brand/skyline-logo.png" alt="Skyline" width={1459} height={400} priority className={`${imageClassName} w-auto`} />
    </NavLink>
  );
}

// Highlight for the navbar item of the page that is open.
const ACTIVE = "bg-white/10 text-gold-light";

async function navItems() {
  const t = (await getDict()).nav;
  return [
    { href: "/properties", label: t.properties },
    { href: "/properties?listing=primary", label: t.primary },
    { href: "/properties?listing=resale", label: t.resale },
    { href: "/properties?purpose=rent", label: t.rent },
    { href: "/projects", label: t.projects },
    { href: "/about", label: t.about },
    { href: "/contact", label: t.contact },
  ];
}

export async function SiteHeader() {
  const t = await getDict();
  const nav = await navItems();
  // Signed-in brokers and owners get a link to their listings (docs/host-accounts.md): beside "List a
  // property" from 640px up (icon only while the inline menu shares the row, 1024–1279px), and first in
  // the scrolling menu row on phones, where the top row has no room for it.
  const host = await currentHostId();
  const account = { href: "/account", label: <><UserIcon className="me-1 align-[-2px]" />{t.account.myAccount}</> };
  const rowLink = "shrink-0 rounded-lg px-3 py-1.5 hover:text-gold-light";
  // The 7 links only fit beside the buttons from 1024px; narrower screens get them in a scrolling
  // second row, so the header never makes the page scroll sideways (docs/site-header.md).
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-espresso/95 text-cream backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo imageClassName="h-8 sm:h-10" />
        <nav className="hidden items-center gap-1 text-sm font-medium lg:flex">
          <NavMenu items={nav} className="whitespace-nowrap rounded-lg px-2.5 py-2 hover:text-gold-light xl:px-3" activeClassName={ACTIVE} />
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitch dark />
          {host && (
            <NavLink
              href="/account"
              aria-label={t.account.myAccount}
              className="btn btn-sm hidden border border-cream/30 whitespace-nowrap text-cream hover:border-gold hover:text-gold-light sm:inline-flex"
            >
              <UserIcon />
              <span className="lg:hidden xl:inline">{t.account.myAccount}</span>
            </NavLink>
          )}
          <NavLink href="/submit" className="btn-primary whitespace-nowrap max-sm:rounded-lg max-sm:px-3 max-sm:py-1.5 max-sm:text-xs">
            {t.nav.listProperty}
          </NavLink>
        </div>
      </div>
      <nav className="container-page flex gap-1 overflow-x-auto pb-2 text-sm font-medium lg:hidden">
        {host && <NavMenu items={[account]} className={`${rowLink} sm:hidden`} activeClassName={ACTIVE} />}
        <NavMenu items={nav} className={rowLink} activeClassName={ACTIVE} />
      </nav>
    </header>
  );
}

export async function SiteFooter() {
  const t = await getDict();
  const nav = await navItems();
  return (
    <footer className="mt-auto bg-espresso text-white/80">
      <div className="container-page flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Image src="/brand/skyline-logo-stacked.png" alt="Skyline" width={1304} height={995} className="h-24 w-auto" />
          <p className="sr-only">{t.siteName}</p>
          <p className="mt-1 text-sm">{t.footer.tagline}</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <NavMenu items={[...nav, { href: "/submit", label: t.nav.listProperty }]} className="hover:text-white" activeClassName="text-gold-light" />
        </nav>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/50">
        © {new Date().getFullYear()} {t.siteName}. {t.footer.rights}
      </div>
    </footer>
  );
}
