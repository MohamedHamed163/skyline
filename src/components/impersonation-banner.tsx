import { ActionForm } from "@/components/action-form";
import { stopImpersonating } from "@/lib/actions";
import { isAdmin } from "@/lib/auth";
import { currentHost } from "@/lib/host-auth";
import { fmt, getDict } from "@/lib/i18n";

// Shown whenever this browser holds both the admin cookie and a host session, i.e. the admin entered a
// host's account from the property page (docs/host-impersonation.md). It never appears for a normal
// host (no admin cookie) or a normal admin (no host session), and "Leave account" drops the host
// session while keeping the admin signed in.
export async function ImpersonationBanner() {
  const [admin, host] = await Promise.all([isAdmin(), currentHost()]);
  if (!admin || !host) return null;
  const t = (await getDict()).impersonation;

  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 bg-gold px-4 py-2 text-sm font-medium text-espresso">
      <p dir="auto">{fmt(t.banner, { username: host.username })}</p>
      <ActionForm action={stopImpersonating} errorClassName="text-red-700">
        <button type="submit" className="btn btn-sm border border-espresso/30 bg-white/70 text-espresso hover:border-espresso">
          {t.exit}
        </button>
      </ActionForm>
    </div>
  );
}
