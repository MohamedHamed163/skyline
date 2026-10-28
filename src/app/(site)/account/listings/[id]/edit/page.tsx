import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { HostEditForm } from "@/components/host-edit-form";
import { canHostEdit } from "@/lib/host-accounts";
import { withPendingEdit } from "@/lib/listing-edits";
import { ownListing } from "@/lib/host-auth";
import { getDict } from "@/lib/i18n";
import { selectableLocations } from "@/lib/locations";
import { getLocations } from "@/lib/store";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).account.editTitle, robots: { index: false } };
}

// The host edits one of their listings (docs/host-edit-approval.md). It opens on their waiting edit, if any.
export default async function HostEditPage({ params }: PageProps<"/account/listings/[id]/edit">) {
  const [t, { host, property }, locations] = await Promise.all([getDict(), ownListing((await params).id), getLocations()]);
  if (!host) redirect("/account");
  if (!property) notFound();
  const back = `/account/listings/${property.id}`;
  // Reserved, sold, archived or rejected: the listing page says to contact Skyline.
  if (!canHostEdit(property)) redirect(back);
  const a = t.account;

  return (
    <section className="container-page py-10">
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href={back} className="text-sm font-medium text-cocoa hover:text-gold-deep">
          {t.dir === "rtl" ? "→" : "←"} {property.title}
        </Link>
        <h1 className="text-2xl font-bold">{a.editTitle}</h1>
        <div className="space-y-1 rounded-xl bg-ivory px-4 py-3 text-sm">
          <p>{property.status === "published" ? a.editNotePublished : a.editInPlaceNote}</p>
          <p className="text-cocoa">{a.documentsNote}</p>
        </div>
        <div className="card p-6 sm:p-10">
          <HostEditForm
            property={withPendingEdit(property)}
            locations={selectableLocations(locations, withPendingEdit(property).location, withPendingEdit(property).subLocation)}
            version={property.pendingEdit?.submittedAt ?? property.updatedAt}
          />
        </div>
      </div>
    </section>
  );
}
