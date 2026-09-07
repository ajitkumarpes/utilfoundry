import Link from "next/link";

export default function NotFound() {
  return (
    <main className="error-shell">
      <div className="error-card">
        <p className="eyebrow">404 · Not found</p>
        <h1>That developer-tool page does not exist.</h1>
        <p>Return to the local toolbox and choose another utility.</p>
        <Link className="primary-button" href="/">
          Back to tools
        </Link>
      </div>
    </main>
  );
}
