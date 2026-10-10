import Link from "next/link";
import { PropertyForm } from "@/components/property-form";
import { getDict } from "@/lib/i18n";

export default async function AdminNewPropertyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [t, params] = await Promise.all([getDict(), searchParams]);
  const rent = params.purpose === "rent";
  const a = t.admin;
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/properties" className="text-sm font-medium text-cocoa hover:text-gold-deep">
        {t.dir === "rtl" ? "→" : "←"} {a.allProperties}
      </Link>
      <h1 className="mt-3 text-2xl font-bold">{rent ? a.newRentalTitle : a.newTitle}</h1>
      <p className="mt-1 text-sm text-cocoa">{rent ? t.fields.rentHint : a.newHint}</p>
      <div className="card mt-6 p-6 sm:p-8">
        <PropertyForm mode="admin" defaultPurpose={rent ? "rent" : "sale"} />
      </div>
    </div>
  );
}
