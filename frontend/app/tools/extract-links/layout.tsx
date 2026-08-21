import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Extract Links",
  description: "Pull every clickable web link out of a PDF into a page-by-page .csv file."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
