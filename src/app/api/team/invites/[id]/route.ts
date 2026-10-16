import { requireOwner } from "@/lib/auth";
import { revokeInvite } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** Owner: cancel an invite link that hasn't been used. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await requireOwner();
  if (session instanceof Response) return session;
  await revokeInvite(session.shop.id, decodeURIComponent((await params).id));
  return new Response(null, { status: 204 });
}
