/**
 * Hand-rolled admin session, in place of pulling in an auth library for one shared
 * password. Built on Web Crypto (`crypto.subtle`, `TextEncoder`, `btoa`) rather than
 * `node:crypto`, so the same module verifies a session both in API routes (Node
 * runtime) and in middleware.ts (Edge runtime) without a separate implementation.
 */

const SESSION_COOKIE_NAME = "admin_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours
const isProd = process.env.NODE_ENV === "production";

function secret(): string {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value) throw new Error("ADMIN_SESSION_SECRET is required");
  return value;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return base64UrlEncode(new Uint8Array(signature));
}

/** Equal-length comparison in constant time; a length mismatch returns immediately. */
function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i += 1) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

export async function createSessionToken(now = Date.now()): Promise<string> {
  const payload = String(now + SESSION_TTL_SECONDS * 1000);
  return `${payload}.${await hmac(payload)}`;
}

export async function verifySessionToken(token: string | undefined | null, now = Date.now()): Promise<boolean> {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = await hmac(payload);
  if (!constantTimeEqual(signature, expected)) return false;
  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export function verifyPassword(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("ADMIN_PASSWORD is required");
  return constantTimeEqual(candidate, expected);
}

export function sessionCookie(token: string): string {
  const secureFlag = isProd ? " Secure;" : "";
  return `${SESSION_COOKIE_NAME}=${token}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly;${secureFlag} SameSite=Lax`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`;
}

export { SESSION_COOKIE_NAME };
