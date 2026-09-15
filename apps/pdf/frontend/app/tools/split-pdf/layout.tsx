import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Split PDF",
  description: "Break a PDF into individual pages, or pull out a specific page range. Free, private, no account needed."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
