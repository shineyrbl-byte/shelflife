import { connection } from "next/server";
import { z } from "zod";
import { hashPassword, hashToken, startSession } from "@/lib/auth";
import { findValidToken, markTokenUsed, setPassword, transaction } from "@/lib/db";
import { readBody } from "@/lib/http";

const INVALID = "This reset link has expired or was already used. Ask for a new one.";

/** Public: is a reset link still valid (so the page can say so before asking for a password). */
export async function GET(req: Request) {
  await connection();
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const valid = token && (await findValidToken(hashToken(token), "reset"));
  return valid ? Response.json({ ok: true }) : Response.json({ error: INVALID }, { status: 404 });
}

const Body = z.object({ token: z.string().min(20).max(100), password: z.string().min(8, "Use at least 8 characters").max(200) });

/** Public: sets a new password from a reset link, logs out every old session, and logs in here. */
export async function POST(req: Request) {
  const body = await readBody(req, Body);
  if (body instanceof Response) return body;
  const tokenHash = hashToken(body.token);
  const passwordHash = await hashPassword(body.password);
  const userId = await transaction(async (tx) => {
    const t = await findValidToken(tokenHash, "reset", tx);
    if (!t?.userId) return null;
    await setPassword(t.userId, passwordHash, tx);
    await markTokenUsed(tokenHash, tx);
    return t.userId;
  });
  if (!userId) return Response.json({ error: INVALID }, { status: 404 });
  await startSession(userId);
  return Response.json({ ok: true });
}
