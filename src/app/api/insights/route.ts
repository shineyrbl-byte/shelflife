import { requireOwner } from "@/lib/auth";
import { connection } from "next/server";
import { listBatchesSince, listWasteSince } from "@/lib/db";
import { itemInsights, orderTips, wasteByWeekday } from "@/lib/insights";
import { today } from "@/lib/schema";

/** Waste patterns and ordering tips over the last N days (default 28 = four of each weekday). */
export async function GET(req: Request) {
  await connection();
  const session = await requireOwner();
  if (session instanceof Response) return session;
  const { shop } = session;
  const days = Math.min(Math.max(Number(new URL(req.url).searchParams.get("days")) || 28, 7), 365);
  const since = today(new Date(Date.now() - (days - 1) * 86400000));
  const history = await listBatchesSince(shop.id, since);
  return Response.json({
    days,
    items: itemInsights(history),
    tips: orderTips(history),
    weekdays: wasteByWeekday(await listWasteSince(shop.id, since)),
  });
}
