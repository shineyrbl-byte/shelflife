import { connection } from "next/server";
import { requireOwner } from "@/lib/auth";
import { listBatchesSince, listSuppliers, supplierAssignments } from "@/lib/db";
import { planItems } from "@/lib/orders";
import { today } from "@/lib/schema";

/** Owner: tomorrow's order plan from the last 28 days, plus suppliers and who supplies what. */
export async function GET() {
  await connection();
  const session = await requireOwner();
  if (session instanceof Response) return session;
  const shopId = session.shop.id;
  const since = today(new Date(Date.now() - 27 * 86400000));
  const [history, suppliers, assigned] = await Promise.all([listBatchesSince(shopId, since), listSuppliers(shopId), supplierAssignments(shopId)]);
  return Response.json({
    shopName: session.shop.name,
    suppliers,
    items: planItems(history).map((i) => ({ ...i, supplierId: assigned.get(i.key) ?? null })),
  });
}
