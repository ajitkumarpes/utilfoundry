import { AppShell } from "@/components/layout/AppShell";

export default function ToolLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
