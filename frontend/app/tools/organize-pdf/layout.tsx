import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Organize Pages",
  description: "Reorder, rotate or remove pages. Drag thumbnails to rearrange, and download when it looks right."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
