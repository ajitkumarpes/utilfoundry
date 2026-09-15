import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pages per Sheet",
  description: "Combine multiple PDF pages onto one printed sheet — handy for handouts and saving paper."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
