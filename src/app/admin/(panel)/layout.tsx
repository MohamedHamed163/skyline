import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LanguageSwitch } from "@/components/language-switch";
import { Logo } from "@/components/site-chrome";
import { adminLogout } from "@/lib/actions";
import { isAdmin } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { getLeads, getProperties } from "@/lib/store";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).admin.metaTitle, robots: { index: false } };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect("/admin/login");

  const [t, properties, leads] = await Promise.all([getDict(), getProperties(), getLeads()]);
  const n = t.admin.nav;
  const pending = properties.filter((p) => p.status === "pending").length;
  const newLeads = leads.filter((l) => l.status === "new").length;

  const nav: { href: string; label: string; count?: number }[] = [
    { href: "/admin", label: n.dashboard },
    { href: "/admin/properties", label: n.properties },
    { href: "/admin/properties?status=pending", label: n.pending, count: pending },
    { href: "/admin/properties?listing=premium", label: n.premium },
    { href: "/admin/properties?listing=resale", label: n.resale },
    { href: "/admin/properties?purpose=rent", label: n.rentals },
    { href: "/admin/leads", label: n.leads, count: newLeads },
    { href: "/admin/sellers", label: n.sellers },
    { href: "/admin/customers", label: n.customers },
    { href: "/admin/properties?status=inactive", label: n.inactive },
  ];

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <aside className="bg-espresso text-cream lg:w-60 lg:shrink-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:block lg:px-5 lg:py-5">
          <Logo href="/admin" />
          <div className="flex items-center gap-2 lg:hidden">
            <LanguageSwitch dark />
            <form action={adminLogout}>
              <button type="submit" className="btn btn-sm border border-cream/30 text-cream hover:border-gold">
                {t.admin.logout}
              </button>
            </form>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 text-sm font-medium lg:flex-col lg:px-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 hover:bg-white/10 hover:text-gold-light"
            >
              {item.label}
              {item.count ? (
                <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-semibold text-espresso">{item.count}</span>
              ) : null}
            </Link>
          ))}
          <div className="mt-2 hidden space-y-2 border-t border-white/10 pt-3 lg:block">
            <LanguageSwitch className="px-3" dark />
            <form action={adminLogout}>
              <button type="submit" className="w-full cursor-pointer rounded-lg px-3 py-2 text-start hover:bg-white/10 hover:text-error">
                {t.admin.logout}
              </button>
            </form>
          </div>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}
