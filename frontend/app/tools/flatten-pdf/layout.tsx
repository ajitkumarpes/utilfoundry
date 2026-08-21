import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flatten PDF",
  description: "Bake filled-in form fields and comment/markup annotations permanently into the page, so they can no longer be edited or removed."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
