import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { assignSupplier } from "@/lib/db";
import { readBody } from "@/lib/http";
import { itemKey } from "@/lib/orders";

const Body = z.object({ item: z.string().trim().min(1).max(60), supplierId: z.string().max(20).nullable() });

/** Owner: remember which supplier an item is ordered from. */
export async function PUT(req: Request) {
  const session = await requireOwner();
  if (session instanceof Response) return session;
  const body = await readBody(req, Body);
  if (body instanceof Response) return body;
  if (!(await assignSupplier(session.shop.id, itemKey(body.item), body.supplierId))) {
    return Response.json({ error: "Supplier not found." }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
