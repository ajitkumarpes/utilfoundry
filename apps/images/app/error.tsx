"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Anything a page throws while rendering lands here, instead of Next's bare error screen. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") console.error(error);
  }, [error]);

  return (
    <main className="main-area">
      <div className="page-inner">
        <section className="card soon-panel" style={{ marginTop: 48 }} role="alert">
          <h2>Something went wrong on this page</h2>
          <p>
            The tool stopped before it finished. Your images never left this browser unless the tool
            says it uses the server, and nothing was kept. Try again, or pick another tool.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" onClick={() => reset()}>Try again</button>
            <Link className="btn" href="/image-compressor">Browse the tools</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
