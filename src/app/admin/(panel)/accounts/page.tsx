import Link from "next/link";
import { EmptyState } from "@/components/admin-ui";
import { HostImpersonate } from "@/components/host-impersonate";
import { HostPasswordReset } from "@/components/host-password-reset";
import { PasswordRequestDismiss } from "@/components/password-request-dismiss";
import { formatDate, telHref, whatsappHref } from "@/lib/format";
import { fmt, getDict } from "@/lib/i18n";
import { filterAccounts, phoneMatches } from "@/lib/password-help";
import { getHostSummaries, getPasswordRequests } from "@/lib/store";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

// Broker and owner accounts, and the forgot-password requests waiting for the admin
// (docs/password-help.md). The admin checks a caller is the owner, then sets a new password here.
export default async function AdminAccountsPage({ searchParams }: PageProps<"/admin/accounts">) {
  const [t, params, accounts, requests] = await Promise.all([getDict(), searchParams, getHostSummaries(), getPasswordRequests()]);
  const a = t.admin.accounts;
  const q = one(params.q).trim();
  const shown = filterAccounts(accounts, q);
  const byId = new Map(accounts.map((h) => [h.id, h]));

  return (
    <div>
      <h1 className="text-2xl font-bold">{a.title}</h1>
      <p className="mt-1 text-sm text-cocoa">{fmt(a.count, { count: accounts.length })}</p>

      {requests.length > 0 && (
        <section className="mt-6">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            {a.requestsTitle}
            <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-semibold text-espresso">{requests.length}</span>
          </h2>
          <p className="mt-1 text-sm text-cocoa">{a.requestsHint}</p>
          <div className="mt-3 space-y-3">
            {requests.map((r) => {
              const host = r.hostId ? byId.get(r.hostId) : undefined;
              return (
                <div key={r.id} className="card border-gold/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold" dir="ltr">
                        {r.username}
                      </p>
                      <p className="text-xs text-cocoa">{fmt(a.requested, { date: formatDate(r.createdAt, t.locale) })}</p>
                    </div>
                    <PasswordRequestDismiss id={r.id} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-cocoa">{a.contactOn}</span>
                    <span className="font-semibold" dir="ltr">
                      {r.phone}
                    </span>
                    <a href={telHref(r.phone)} className="btn-outline btn-sm">
                      {t.call}
                    </a>
                    <a
                      href={whatsappHref(r.phone, fmt(a.waGreeting, { username: r.username }))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-outline btn-sm"
                    >
                      {t.whatsapp}
                    </a>
                  </div>
                  {host ? (
                    <>
                      <p className={`mt-2 text-xs ${phoneMatches(r.phone, host.phones) ? "text-success-deep" : "text-red-700"}`}>
                        {host.phones.length === 0 ? a.noPhones : phoneMatches(r.phone, host.phones) ? a.phoneMatches : a.phoneDiffers}
                      </p>
                      <div className="mt-3 border-t border-line pt-3">
                        <HostPasswordReset hostId={host.id} username={host.username} bare />
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-red-700">{a.noAccount}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <form className="card mt-6 flex flex-wrap gap-3 p-4">
        <input name="q" defaultValue={q} placeholder={a.search} aria-label={t.search} className="field min-w-56 flex-1" />
        <button type="submit" className="btn-primary">
          {t.search}
        </button>
        {q && (
          <Link href="/admin/accounts" className="btn-outline">
            {t.clear}
          </Link>
        )}
      </form>

      <div className="mt-5 space-y-3">
        {shown.length === 0 ? (
          <EmptyState>{accounts.length ? a.noMatch : a.empty}</EmptyState>
        ) : (
          shown.map((h) => (
            <div key={h.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    <span dir="ltr">{h.username}</span>
                    {h.temporaryPassword && (
                      <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs font-medium text-gold-deep">{a.temporary}</span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-cocoa">
                    {fmt(a.created, { date: formatDate(h.createdAt, t.locale) })} · {fmt(a.listings, { count: h.listings })}
                  </p>
                  {h.phones.length > 0 && (
                    <p className="mt-1 flex flex-wrap gap-x-3 text-sm">
                      {h.phones.map((p) => (
                        <span key={p} dir="ltr">
                          {p}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
                <HostImpersonate hostId={h.id} username={h.username} bare />
              </div>
              <div className="mt-3 border-t border-line pt-3">
                <HostPasswordReset hostId={h.id} username={h.username} bare />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
