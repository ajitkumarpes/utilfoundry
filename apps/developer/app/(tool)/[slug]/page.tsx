import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Workbench } from "@/components/Workbench";
import { TOOLS, getTool } from "@/lib/tools";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return TOOLS.map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) return { title: "Tool not found" };
  return {
    title: tool.name,
    description: tool.description,
    alternates: { canonical: `/${tool.slug}` },
    openGraph: { title: `${tool.name} — UtilFoundry Developer Tools`, description: tool.description, url: `/${tool.slug}` }
  };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();
  return (
    <>
      <PageHeader tool={tool} />
      {/* Keyed so moving between tools starts a fresh bench instead of carrying state over. */}
      <Workbench key={tool.id} tool={tool} />
      <SiteFooter />
    </>
  );
}
