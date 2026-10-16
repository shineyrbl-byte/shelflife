import { requireOwner } from "@/lib/auth";
import { deleteStaffUser, getUser } from "@/lib/db";
import { notFound } from "@/lib/http";

type Ctx = { params: Promise<{ userId: string }> };

/** Owner: remove a staff member's login. They're logged out everywhere immediately. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await requireOwner();
  if (session instanceof Response) return session;
  const user = await getUser(session.shop.id, (await params).userId);
  if (!user) return notFound();
  if (user.role === "owner") return Response.json({ error: "The owner's login can't be removed." }, { status: 409 });
  await deleteStaffUser(session.shop.id, user.id);
  return new Response(null, { status: 204 });
}
