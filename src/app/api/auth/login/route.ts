import { z } from "zod";
import { hashPassword, startSession, verifyPassword } from "@/lib/auth";
import { findUserByEmail } from "@/lib/db";
import { readBody } from "@/lib/http";

const Body = z.object({ email: z.string().trim().toLowerCase(), password: z.string().max(200) });

// Compared against when the email doesn't exist, so both cases take the same time.
const dummyHash = hashPassword("not-a-real-password");

export async function POST(req: Request) {
  const body = await readBody(req, Body);
  if (body instanceof Response) return body;
  const user = await findUserByEmail(body.email);
  const ok = await verifyPassword(body.password, user?.passwordHash ?? (await dummyHash));
  if (!user || !ok) return Response.json({ error: "Wrong email or password." }, { status: 401 });
  await startSession(user.id);
  return Response.json({ ok: true });
}
