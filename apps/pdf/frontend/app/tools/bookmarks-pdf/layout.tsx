import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit Bookmarks",
  description: "Add, remove, or reorder the page bookmarks shown in a PDF viewer's sidebar."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
