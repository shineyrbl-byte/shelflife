import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { deleteSession, findSession, insertSession, type Shop, type User } from "./db";

// Email + password accounts with server-side sessions. No third-party auth service.

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const SESSION_COOKIE = "sl_session";
const SESSION_DAYS = 30;

/** "scrypt$<salt>$<hash>", both base64url. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scrypt(password, Buffer.from(salt, "base64url"), expected.length);
  return timingSafeEqual(actual, expected);
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("base64url");

/** Starts a session for the user and sets the cookie. */
export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  await insertSession(hashToken(token), userId, expires.toISOString());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(hashToken(token));
  jar.delete(SESSION_COOKIE);
}

/** The logged-in user and their shop, or null. */
export async function currentSession(): Promise<{ user: User; shop: Shop } | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? findSession(hashToken(token)) : null;
}

/**
 * For staff API routes: the logged-in user's shop, or a 401 response to return as is.
 *   const shop = await requireShop(); if (shop instanceof Response) return shop;
 */
export async function requireShop(): Promise<Shop | Response> {
  const session = await currentSession();
  return session ? session.shop : Response.json({ error: "Please log in again." }, { status: 401 });
}
