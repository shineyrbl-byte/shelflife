import { connection } from "next/server";
import { requireOwner } from "@/lib/auth";
import { rescueTotals } from "@/lib/db";
import { impactOf } from "@/lib/impact";
import { today } from "@/lib/schema";

/** The shop's impact this month and since it started using ShelfLife. */
export async function GET() {
  await connection();
  const session = await requireOwner();
  if (session instanceof Response) return session;
  const { shop } = session;
  const monthStart = today().slice(0, 8) + "01";
  const [month, allTime] = await Promise.all([rescueTotals(shop.id, monthStart), rescueTotals(shop.id)]);
  return Response.json({
    month: impactOf(month.rows, month.money, month.bundlesSold),
    allTime: impactOf(allTime.rows, allTime.money, allTime.bundlesSold),
  });
}
