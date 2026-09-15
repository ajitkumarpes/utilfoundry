import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Header & Footer",
  description: "Build a compound header and footer — text, page numbers, dates, or Bates numbering in any of 6 positions."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
