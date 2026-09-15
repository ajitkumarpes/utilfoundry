import Link from "next/link";
import { TOOLS } from "@/lib/tools";

export default function NotFound() {
  return (
    <main className="main-area">
      <div className="page-inner">
        <section className="card soon-panel" style={{ marginTop: 48 }}>
          <h2>That tool does not exist</h2>
          <p>
            The address you opened does not match any of the {TOOLS.length} image tools in this
            service. Pick one from the list instead.
          </p>
          <Link className="btn btn-primary" href="/image-compressor">Browse the tools</Link>
        </section>
      </div>
    </main>
  );
}
