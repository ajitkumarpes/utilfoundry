import { redirect } from "next/navigation";
import { DEFAULT_TOOL } from "@/lib/tools";

export default function Home() {
  redirect(`/${DEFAULT_TOOL}`);
}
