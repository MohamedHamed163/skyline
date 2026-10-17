import type { Metadata } from "next";
import Link from "next/link";
import { HostListingRow, HostName, SignOutButton } from "@/components/account-ui";
import { HostAuthForm } from "@/components/host-auth-form";
import { HostPasswordForm } from "@/components/host-password-form";
import { countListings } from "@/lib/host-accounts";
import { currentHost } from "@/lib/host-auth";
import { getDict } from "@/lib/i18n";
import { getHostProperties } from "@/lib/store";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).account.metaTitle, robots: { index: false } };
}

// The host's account (docs/host-accounts.md): "List a property" and every listing they sent, with
// how many are Primary and Resale, then Change password. Signed-out visitors see the sign-in form.
export default async function AccountPage() {
  const [t, host] = await Promise.all([getDict(), currentHost()]);
  const a = t.account;

  if (!host) {
    return (
      <section className="container-page py-12">
        <div className="card mx-auto max-w-md p-6 sm:p-8">
          <HostAuthForm initialMode="signIn" />
        </div>
      </section>
    );
  }

  const listings = await getHostProperties(host.id);
  const counts = countListings(listings);
  const tiles = [
    [a.total, counts.total],
    [t.listing.primary, counts.primary],
    [t.listing.resale, counts.resale],
  ] as const;

  return (
    <>
      <section className="bg-espresso text-white">
        <div className="container-page py-10 sm:py-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow-light">
                {a.signedInAs} <HostName host={host} className="normal-case tracking-normal" />
              </p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{a.title}</h1>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <Link href="/submit" className="btn-primary">
                {t.nav.listProperty}
              </Link>
              <SignOutButton t={t} light />
            </div>
          </div>
          <dl className="mt-8 grid grid-cols-3 gap-3 sm:max-w-lg">
            {tiles.map(([label, n]) => (
              <div key={label} className="rounded-2xl border border-white/15 bg-white/5 p-4">
                <dt className="text-xs text-white/70">{label}</dt>
                <dd className="mt-1 text-2xl font-extrabold">{n}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="container-page py-10">
        {/* The admin set this password (they forgot theirs): ask for their own. */}
        {host.temporaryPassword && (
          <p className="mb-6 rounded-xl bg-gold/15 px-4 py-3 text-sm font-medium text-gold-deep" role="status">
            {a.temporaryPassword}{" "}
            <a href="#password" className="font-semibold underline">
              {a.changePassword}
            </a>
          </p>
        )}
        {listings.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-cocoa">{a.empty}</p>
            <Link href="/submit" className="btn-primary mt-5">
              {t.nav.listProperty}
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {listings.map((p) => (
              <HostListingRow key={p.id} t={t} p={p} />
            ))}
          </ul>
        )}
      </section>

      <section id="password" className="container-page scroll-mt-24 pb-12">
        <div className="card max-w-xl p-5 sm:p-6">
          <h2 className="text-lg font-bold">{a.changePassword}</h2>
          <p className="mt-1 text-sm text-cocoa">{a.changePasswordHint}</p>
          <HostPasswordForm username={host.username} />
        </div>
      </section>
    </>
  );
}
