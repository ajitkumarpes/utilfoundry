import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Grayscale PDF",
  description: "Desaturate photos and scanned pages to black & white. Free, private, no account needed."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
