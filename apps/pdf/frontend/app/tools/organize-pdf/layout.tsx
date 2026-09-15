import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Organize Pages",
  description: "Reorder, rotate, duplicate, or remove pages — or insert a blank page or pages from another PDF. Drag thumbnails to rearrange, and download when it looks right."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
