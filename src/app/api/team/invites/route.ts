import { newToken, requireOwner } from "@/lib/auth";
import { insertToken } from "@/lib/db";
import { appUrl } from "@/lib/urls";

const INVITE_DAYS = 7;

/** Owner: a one-time link for a new staff member to set up their own login. Shown once; only its hash is kept. */
export async function POST(req: Request) {
  const session = await requireOwner();
  if (session instanceof Response) return session;
  const { token, tokenHash } = newToken();
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86400000).toISOString();
  await insertToken({ tokenHash, kind: "invite", shopId: session.shop.id, expiresAt });
  return Response.json({ url: `${appUrl(req)}/join?token=${token}`, expiresAt }, { status: 201 });
}
