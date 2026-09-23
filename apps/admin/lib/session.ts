/**
 * The admin session: one shared password, and a signed cookie that proves it was entered.
 *
 * The token is `expiry.nonce.signature`, signed with HMAC-SHA256 under a key derived from
 * both ADMIN_SESSION_SECRET and ADMIN_PASSWORD — so rotating either one signs every
 * existing session out, which is what an operator changing a leaked password expects.
 * Proxy runs on the Node.js runtime in Next 16, so node:crypto is available everywhere.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const SESSION_TTL_SECONDS = 12 * 60 * 60;

/** `__Host-` binds the cookie to this exact host over HTTPS, so no subdomain can set or read it. */
export function sessionCookieName(production = process.env.NODE_ENV === "production") {
  return production ? "__Host-uf_admin" : "uf_admin";
}

function required(name: "ADMIN_SESSION_SECRET" | "ADMIN_PASSWORD"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function signingKey(): Buffer {
  return createHash("sha256").update(`${required("ADMIN_SESSION_SECRET")}\0${required("ADMIN_PASSWORD")}`).digest();
}

function sign(payload: string): string {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

/** Compares digests of both sides, so neither the content nor the length of the secret leaks. */
function safeEqual(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

export function createSessionToken(now = Date.now()): string {
  const payload = `${now + SESSION_TTL_SECONDS * 1000}.${randomBytes(12).toString("base64url")}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined | null, now = Date.now()): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expiry, nonce, signature] = parts;
  if (!safeEqual(signature, sign(`${expiry}.${nonce}`))) return false;
  const expiresAt = Number(expiry);
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export function verifyPassword(candidate: string): boolean {
  return safeEqual(candidate, required("ADMIN_PASSWORD"));
}

export function sessionCookie(token: string, production = process.env.NODE_ENV === "production"): string {
  const secure = production ? " Secure;" : "";
  return `${sessionCookieName(production)}=${token}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly;${secure} SameSite=Lax`;
}

export function clearSessionCookie(production = process.env.NODE_ENV === "production"): string {
  const secure = production ? " Secure;" : "";
  return `${sessionCookieName(production)}=; Max-Age=0; Path=/; HttpOnly;${secure} SameSite=Lax`;
}
