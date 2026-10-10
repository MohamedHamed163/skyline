import Link from "next/link";
import { EmptyState } from "@/components/admin-ui";
import { getDict } from "@/lib/i18n";

// Shown inside the admin layout (e.g. an unknown property id), in the admin's language.
export default async function AdminNotFound() {
  const t = await getDict();
  return (
    <div className="space-y-4">
      <EmptyState>{t.admin.notFound}</EmptyState>
      <Link href="/admin/properties" className="btn-outline btn-sm">
        {t.dir === "rtl" ? "→" : "←"} {t.admin.allProperties}
      </Link>
    </div>
  );
}
