import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Add Watermark",
  description: "Stamp text like \"CONFIDENTIAL\" or a company name across every page. Supports Hindi/Devanagari text."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
