import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Extract Images",
  description: "Pull every embedded photo or image out of a PDF as separate PNG files. Free, private, no account needed."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
