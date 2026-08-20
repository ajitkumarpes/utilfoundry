import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lock PDF",
  description: "Restrict printing and copying, and optionally require a password just to open the file."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
