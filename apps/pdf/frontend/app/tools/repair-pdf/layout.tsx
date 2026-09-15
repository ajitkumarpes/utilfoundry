import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Repair PDF",
  description: "Fix a PDF that won't open properly — recovers what it can and rebuilds a clean, valid file."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
