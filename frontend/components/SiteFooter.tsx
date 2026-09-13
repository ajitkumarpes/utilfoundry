import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <span>
          UtilFoundry PDF · Part of the UtilFoundry toolbox · Files are processed privately and
          removed automatically.
        </span>
        <div style={{ display: "flex", gap: 18 }}>
          <Link href="/privacy" style={{ color: "inherit" }}>Privacy</Link>
          <Link href="/terms" style={{ color: "inherit" }}>Terms</Link>
        </div>
      </div>
    </footer>
  );
}
