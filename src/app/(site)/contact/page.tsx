import type { Metadata } from "next";
import Link from "next/link";
import { LeadForm } from "@/components/lead-form";
import { getDict } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).contact.metaTitle };
}

export default async function ContactPage() {
  const t = (await getDict()).contact;
  return (
    <div className="container-page grid gap-10 py-14 md:grid-cols-2">
      <div>
        <p className="eyebrow">{t.eyebrow}</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">{t.title}</h1>
        <p className="mt-5 text-lg leading-relaxed text-cocoa">{t.body}</p>
        <p className="mt-4 text-sm text-cocoa">
          {t.hint1}{" "}
          <Link href="/properties" className="font-semibold text-gold-deep hover:underline">
            {t.hintLink}
          </Link>{" "}
          {t.hint2}
        </p>
      </div>
      <div className="card p-6">
        <LeadForm startOpen />
      </div>
    </div>
  );
}
