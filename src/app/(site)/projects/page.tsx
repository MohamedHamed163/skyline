import type { Metadata } from "next";
import { ProjectCard } from "@/components/project-card";
import { getDict } from "@/lib/i18n";
import { groupProjects } from "@/lib/search";
import { getPublishedProperties } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).project.metaTitle };
}

export default async function ProjectsPage() {
  const [t, published] = await Promise.all([getDict(), getPublishedProperties()]);
  const projects = groupProjects(published.filter((p) => p.purpose === "sale"));
  return (
    <div className="container-page py-10">
      <p className="eyebrow">{t.home.projectsEyebrow}</p>
      <h1 className="mt-2 text-3xl font-bold">{t.project.title}</h1>
      <p className="mt-2 text-cocoa">{t.project.intro}</p>
      {projects.length ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => <ProjectCard key={p.slug} t={t} project={p} />)}
        </div>
      ) : (
        <p className="card mt-8 p-8 text-center text-cocoa">{t.project.empty}</p>
      )}
    </div>
  );
}
