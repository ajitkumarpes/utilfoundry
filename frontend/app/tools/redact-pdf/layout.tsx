import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Redact PDF",
  description: "Draw boxes over text or images to remove them for good — the underlying content is deleted, not just painted over."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
