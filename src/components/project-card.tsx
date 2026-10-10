import Link from "next/link";
import { PinIcon } from "@/components/icons";
import { ListingBadge, Photo } from "@/components/property-card";
import { formatPrice } from "@/lib/format";
import { fmt, type Dict } from "@/lib/i18n";
import { localName } from "@/lib/locations";
import type { Project } from "@/lib/search";

export function ProjectCard({ t, project }: { t: Dict; project: Project }) {
  return (
    <Link href={`/projects/${project.slug}`} className="card group relative isolate flex aspect-[4/3] flex-col justify-end overflow-hidden p-5 text-cream">
      <Photo src={project.cover} alt={project.compound} className="absolute inset-0 -z-10 h-full w-full transition-transform duration-500 group-hover:scale-105" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-deep via-deep/60 to-transparent" />
      <ListingBadge type={project.listingType} label={t.listing[project.listingType]} className="absolute start-4 top-4" />
      <p className="text-xl font-extrabold">{project.compound}</p>
      <p className="flex items-center gap-1.5 text-sm text-cream/80">
        <PinIcon /> {localName(t, project.locationName)} · {fmt(t.project.units, { n: project.properties.length })}
      </p>
      <p className="mt-2 text-sm font-semibold text-gold-light">{fmt(t.project.from, { price: formatPrice(project.minPrice, t.currency) })}</p>
    </Link>
  );
}

