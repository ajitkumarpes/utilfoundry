import { AdminShell } from "@/components/AdminShell";
import { requireSession } from "@/lib/auth";
import { countUnreviewed } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  const unreviewed = await countUnreviewed();
  return <AdminShell unreviewed={unreviewed}>{children}</AdminShell>;
}
