import { z } from "zod";
import { hashPassword, hashToken, startSession } from "@/lib/auth";
import { createStaffUser, findUserByEmail, findValidToken, markTokenUsed, transaction } from "@/lib/db";
import { readBody } from "@/lib/http";

const Body = z.object({
  token: z.string().min(20).max(100),
  name: z.string().trim().min(1, "Add your name").max(40),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

/** Public: a staff member accepts an invite link and creates their own login. Each link works once. */
export async function POST(req: Request) {
  const body = await readBody(req, Body);
  if (body instanceof Response) return body;
  const tokenHash = hashToken(body.token);
  const passwordHash = await hashPassword(body.password);
  const result = await transaction(async (tx) => {
    const invite = await findValidToken(tokenHash, "invite", tx);
    if (!invite) return { status: 404, error: "This invite link has expired or was already used. Ask the shop owner for a new one." };
    if (await findUserByEmail(body.email, tx)) return { status: 409, error: "There's already an account with that email. Log in instead, or use another email." };
    const user = await createStaffUser(invite.shopId, body.name, body.email, passwordHash, tx);
    await markTokenUsed(tokenHash, tx);
    return { user };
  });
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  await startSession(result.user.id);
  return Response.json({ ok: true }, { status: 201 });
}
