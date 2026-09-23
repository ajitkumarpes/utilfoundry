import Link from "next/link";

export default function NotFound() {
  return (
    <main className="status-page">
      <div className="card status-card">
        <h1>Page not found</h1>
        <p>There is nothing at this address in the admin.</p>
        <Link href="/admin" className="btn btn-primary">Go to the overview</Link>
      </div>
    </main>
  );
}
