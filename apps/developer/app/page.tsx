import { redirect } from "next/navigation";
import { DEFAULT_TOOL, getToolById } from "@/lib/tools";

/** `?tool=jwt` was how this app linked to a tool before each one had its own page. */
type HomeProps = { searchParams: Promise<{ tool?: string }> };

export default async function Home({ searchParams }: HomeProps) {
  const { tool } = await searchParams;
  const requested = tool ? getToolById(tool) : undefined;
  redirect(`/${requested?.slug ?? DEFAULT_TOOL}`);
}
