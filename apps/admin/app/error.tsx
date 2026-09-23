"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

/** Shown when a page fails to load — most often because the database is unreachable. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="status-page">
      <div className="card status-card">
        <span className="status-icon is-error"><AlertTriangle size={22} aria-hidden /></span>
        <h1>This page could not load</h1>
        <p>The dashboard could not reach its data. It is usually the database restarting; try again in a moment.</p>
        <button type="button" className="btn btn-primary" onClick={reset}><RotateCcw size={16} aria-hidden /> Try again</button>
      </div>
    </main>
  );
}
