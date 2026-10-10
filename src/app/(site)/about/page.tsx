import type { Metadata } from "next";
import Link from "next/link";
import { getDict } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).about.metaTitle };
}

export default async function AboutPage() {
  const t = (await getDict()).about;
  return (
    <div className="container-page max-w-3xl py-14">
      <p className="eyebrow">{t.eyebrow}</p>
      <h1 className="mt-2 text-4xl font-extrabold tracking-tight">{t.title}</h1>
      <p className="mt-5 text-lg leading-relaxed text-cocoa">{t.body}</p>
      <div className="mt-10 space-y-4">
        {t.points.map(([title, body]) => (
          <div key={title} className="card p-5">
            <p className="font-semibold">{title}</p>
            <p className="mt-1 text-sm text-cocoa">{body}</p>
          </div>
        ))}
      </div>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/properties" className="btn-primary">
          {t.browse}
        </Link>
        <Link href="/contact" className="btn-outline">
          {t.contact}
        </Link>
      </div>
    </div>
  );
}
