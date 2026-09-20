"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/feedback", label: "Feedback" },
  { href: "/admin/visitors", label: "Visitors" }
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <>
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>
          {link.label}
        </Link>
      ))}
    </>
  );
}
