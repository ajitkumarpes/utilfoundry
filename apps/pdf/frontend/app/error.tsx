"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Anything a page throws while rendering lands here, instead of Next's bare error screen. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") console.error(error);
  }, [error]);

  return (
    <main>
      <section className="tool-hero" role="alert">
        <h1>Something went wrong</h1>
        <p>This page stopped before it finished. Try again, or go back to the tools. Anything you uploaded is removed automatically, as the privacy policy describes.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24, flexWrap: "wrap" }}>
          <button type="button" className="primary-btn" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/" className="secondary-btn">
            Back to all tools
          </Link>
        </div>
      </section>
    </main>
  );
}
