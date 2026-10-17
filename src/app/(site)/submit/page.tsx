import type { Metadata } from "next";
import { HostBar } from "@/components/account-ui";
import { HostAuthForm } from "@/components/host-auth-form";
import { PropertyForm } from "@/components/property-form";
import { currentHost, knownHost } from "@/lib/host-auth";
import { getDict } from "@/lib/i18n";
import { getActiveLocations } from "@/lib/store";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).submit.metaTitle };
}

// Signed-in hosts get the property form. Everyone else first creates an account, or signs in if this
// browser has had one before (docs/host-accounts.md).
export default async function SubmitPage() {
  const [dict, host] = await Promise.all([getDict(), currentHost()]);
  const t = dict.submit;
  return (
    <>
      <section className="bg-espresso text-white">
        <div className="container-page py-14 sm:py-16">
          <p className="eyebrow-light">{t.eyebrow}</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-extrabold tracking-tight">{t.title}</h1>
          <p className="mt-4 max-w-xl text-white/80">{t.subtitle}</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {t.benefits.map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-white/15 bg-white/5 p-5">
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-sm text-white/70">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-12">
        {host ? (
          <div className="mx-auto max-w-3xl">
            <HostBar t={dict} host={host} />
            <div className="card p-6 sm:p-10">
              <PropertyForm mode="public" locations={await getActiveLocations()} />
            </div>
          </div>
        ) : (
          <div className="card mx-auto max-w-md p-6 sm:p-8">
            <HostAuthForm initialMode={(await knownHost()) ? "signIn" : "signUp"} />
          </div>
        )}
      </section>
    </>
  );
}
