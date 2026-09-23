"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleAlert, Eye, EyeOff, Loader2, Lock } from "lucide-react";

/** Only a path inside the admin is an acceptable place to return to after signing in. */
function safeNext(value: string | null) {
  return value && /^\/admin(\/[\w-]*)*$/.test(value) ? value : "/admin";
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Sign-in failed. Try again.");
        return;
      }
      router.replace(safeNext(params.get("next")));
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="login-card" onSubmit={submit}>
      <span className="login-icon"><Lock size={22} aria-hidden /></span>
      <h1>UtilFoundry Admin</h1>
      <p>Sign in to review feedback and visitor analytics.</p>
      <label htmlFor="password">Password</label>
      <div className="password-field">
        <input
          id="password"
          name="password"
          type={visible ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : undefined}
          autoFocus
          required
        />
        <button type="button" className="icon-button" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}>
          {visible ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
        </button>
      </div>
      {error && <p id="login-error" className="login-error" role="alert"><CircleAlert size={15} aria-hidden />{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={submitting || !password}>
        {submitting && <Loader2 size={16} className="spin" aria-hidden />}
        {submitting ? "Signing in…" : "Sign in"}
      </button>
      <p className="login-note">You stay signed in for 12 hours on this browser.</p>
    </form>
  );
}
