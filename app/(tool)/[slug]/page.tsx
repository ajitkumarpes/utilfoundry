import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolPage } from "@/components/tools/ToolPage";
import { TOOLS, getTool } from "@/lib/tools";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return TOOLS.map((tool) => ({ slug: tool.id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) return { title: "Tool not found" };
  return {
    title: tool.name,
    description: tool.description,
    alternates: { canonical: `/${tool.id}` },
    openGraph: { title: `${tool.name} — UtilFoundry Images`, description: tool.description, url: `/${tool.id}` }
  };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();
  return <ToolPage tool={tool} />;
}
