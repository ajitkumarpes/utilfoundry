import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionCookieName, verifySessionToken } from "./session";

/**
 * A second, independent session check inside the protected layout. The proxy already
 * turns unauthenticated requests away; this keeps the pages safe even if a future change to
 * the proxy's matcher were to let a request through.
 */
export async function requireSession() {
  const token = (await cookies()).get(sessionCookieName())?.value;
  if (!verifySessionToken(token)) redirect("/admin/login");
}
