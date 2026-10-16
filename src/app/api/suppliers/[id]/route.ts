import { requireOwner } from "@/lib/auth";
import { deleteSupplier } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** Owner: remove a supplier (items assigned to them become unassigned). */
export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await requireOwner();
  if (session instanceof Response) return session;
  await deleteSupplier(session.shop.id, (await params).id);
  return new Response(null, { status: 204 });
}
