import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Add Page Numbers",
  description: "Number every page automatically — pick where the numbers go and where counting starts."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
