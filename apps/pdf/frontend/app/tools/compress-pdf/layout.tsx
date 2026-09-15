import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compress PDF",
  description: "Shrink image-heavy PDFs — scans, photos, reports — while keeping them readable. Free, private, no account needed."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
