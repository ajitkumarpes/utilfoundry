"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") console.error(error);
  }, [error]);

  return (
    <main className="error-shell" role="alert">
      <div className="error-card">
        <p className="eyebrow">Something went wrong</p>
        <h1>The tool could not finish that action.</h1>
        <p>Nothing was uploaded. Check the input and try again.</p>
        <button className="primary-button" onClick={() => reset()}>
          Try again
        </button>
      </div>
    </main>
  );
}
