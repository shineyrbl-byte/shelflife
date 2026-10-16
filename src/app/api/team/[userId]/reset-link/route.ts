import { createResetLink, requireOwner } from "@/lib/auth";
import { getUser } from "@/lib/db";
import { notFound } from "@/lib/http";
import { appUrl } from "@/lib/urls";

type Ctx = { params: Promise<{ userId: string }> };

/** Owner: a password reset link for a staff member who forgot theirs (valid 24 hours, shown once). */
export async function POST(req: Request, { params }: Ctx) {
  const session = await requireOwner();
  if (session instanceof Response) return session;
  const user = await getUser(session.shop.id, (await params).userId);
  if (!user || user.role !== "staff") return notFound();
  return Response.json(await createResetLink(appUrl(req), session.shop.id, user.id, 24), { status: 201 });
}
