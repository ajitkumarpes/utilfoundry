import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="login-shell">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
