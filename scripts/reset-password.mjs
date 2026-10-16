// For whoever runs this ShelfLife site: creates a one-time password reset link for any account
// (e.g. a shop owner who forgot their password and email isn't set up). Valid 24 hours.
// Uses the same database as the app: the local file, or Turso if TURSO_DATABASE_URL is set in .env.local.
//
// usage: npm run reset-password -- --email owner@cafe.com [--url https://your-app.vercel.app]

import { createClient } from "@libsql/client";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const email = arg("email", "").trim().toLowerCase();
const base = arg("url", process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
if (!email) {
  console.error("Usage: npm run reset-password -- --email someone@example.com [--url https://your-app.vercel.app]");
  process.exit(1);
}

const db = process.env.TURSO_DATABASE_URL
  ? createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })
  : createClient({ url: `file:${path.join(process.cwd(), "data", "shelflife.db")}` });

const user = (await db.execute({ sql: "SELECT id, shop_id FROM users WHERE email = ?", args: [email] })).rows[0];
if (!user) {
  console.error(`No account with the email ${email}${process.env.TURSO_DATABASE_URL ? "" : " in the local database (set TURSO_DATABASE_URL to use the online one)"}.`);
  process.exit(1);
}

// Same format the app uses: only the token's SHA-256 hash is stored.
const token = randomBytes(32).toString("base64url");
const now = new Date();
await db.execute({
  sql: "INSERT INTO tokens (token_hash, kind, shop_id, user_id, created_at, expires_at) VALUES (?, 'reset', ?, ?, ?, ?)",
  args: [createHash("sha256").update(token).digest("base64url"), user.shop_id, user.id, now.toISOString(), new Date(now.getTime() + 86400000).toISOString()],
});
console.log(`Reset link for ${email} (works once, for 24 hours). Send it only to them:\n\n${base}/reset?token=${token}\n`);
