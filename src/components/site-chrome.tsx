import Image from "next/image";
import Link from "next/link";
import { LanguageSwitch } from "@/components/language-switch";
import { getDict } from "@/lib/i18n";

export function Logo({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={`inline-flex shrink-0 items-center ${className}`}>
      <Image src="/brand/skyline-logo.png" alt="Skyline" width={1459} height={400} priority className="h-10 w-auto" />
    </Link>
  );
}

async function navItems() {
  const t = (await getDict()).nav;
  return [
    ["/properties", t.properties],
    ["/properties?listing=premium", t.premium],
    ["/properties?listing=resale", t.resale],
    ["/properties?purpose=rent", t.rent],
    ["/projects", t.projects],
    ["/about", t.about],
    ["/contact", t.contact],
  ];
}

export async function SiteHeader() {
  const t = await getDict();
  const nav = await navItems();
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-espresso/95 text-cream backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-1 text-sm font-medium md:flex">
          {nav.map(([href, label]) => (
            <Link key={href} href={href} className="rounded-lg px-3 py-2 hover:text-gold-light">
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitch dark />
          <Link href="/submit" className="btn-primary">
            {t.nav.listProperty}
          </Link>
        </div>
      </div>
      <nav className="container-page flex gap-1 overflow-x-auto pb-2 text-sm font-medium md:hidden">
        {nav.map(([href, label]) => (
          <Link key={href} href={href} className="shrink-0 rounded-lg px-3 py-1.5 hover:text-gold-light">
            {label}
          </Link>
        ))}
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
          {nav.map(([href, label]) => (
            <Link key={href} href={href} className="hover:text-white">
              {label}
            </Link>
          ))}
          <Link href="/submit" className="hover:text-white">
            {t.nav.listProperty}
          </Link>
        </nav>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/50">
        © {new Date().getFullYear()} {t.siteName}. {t.footer.rights}
      </div>
    </footer>
  );
}
