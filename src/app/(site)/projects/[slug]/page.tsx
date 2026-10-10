import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PinIcon } from "@/components/icons";
import { ListingBadge, Photo, PropertyCard } from "@/components/property-card";
import { formatPrice } from "@/lib/format";
import { fmt, getDict } from "@/lib/i18n";
import { avgPricePerSqm, groupProjects } from "@/lib/search";
import { getPublishedProperties } from "@/lib/store";

export const dynamic = "force-dynamic";

async function findProject(params: Promise<{ slug: string }>) {
  const [{ slug }, published] = await Promise.all([params, getPublishedProperties()]);
  return groupProjects(published.filter((p) => p.purpose === "sale")).find((p) => p.slug === slug);
}

export async function generateMetadata({ params }: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const [t, project] = await Promise.all([getDict(), findProject(params)]);
  return { title: project ? project.compound : t.project.notFound };
}

export default async function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  const [t, project] = await Promise.all([getDict(), findProject(params)]);
  if (!project) notFound();
  const pr = t.project;
  const summary = [
    [pr.homes, project.properties.length],
    [pr.priceRange, `${formatPrice(project.minPrice, t.currency)} – ${formatPrice(project.maxPrice, t.currency)}`],
    [t.market.avgSqm, formatPrice(avgPricePerSqm(project.properties), t.currency)],
    [pr.types, project.types.map((x) => t.type[x]).join(" · ")],
  ];

  return (
    <>
      <section className="relative isolate overflow-hidden bg-espresso text-cream">
        <Photo src={project.cover} alt="" className="absolute inset-0 -z-10 h-full w-full opacity-40" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-deep via-espresso/70 to-espresso/30" />
        <div className="container-page py-16 sm:py-24">
          <Link href="/projects" className="text-sm text-cream/80 hover:text-cream">{t.dir === "rtl" ? "→" : "←"} {t.home.allProjects}</Link>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <ListingBadge type={project.listingType} label={t.listing[project.listingType]} />
          </div>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight">{project.compound}</h1>
          <p className="mt-2 flex items-center gap-1.5 text-cream/80"><PinIcon /> {t.location[project.location]}</p>
        </div>
      </section>

      <div className="container-page relative z-10 -mt-8">
        <dl className="card grid grid-cols-2 gap-4 p-5 sm:grid-cols-4 sm:p-6">
          {summary.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs uppercase tracking-wide text-cocoa">{label}</dt>
              <dd className="mt-1 font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <section className="container-page py-12">
        <h2 className="text-2xl font-bold">{fmt(pr.units, { n: project.properties.length })}</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {project.properties.map((p) => <PropertyCard key={p.id} property={p} />)}
        </div>
      </section>
    </>
  );
}
