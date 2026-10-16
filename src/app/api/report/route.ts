import { connection } from "next/server";
import { bundleRevenue, listStock, outcomeTotals } from "@/lib/db";
import { freshness, today } from "@/lib/schema";

/** Waste vs. rescue over the last N days (default 7), plus the stock value at risk right now. */
export async function GET(req: Request) {
  await connection();
  const days = Math.min(Math.max(Number(new URL(req.url).searchParams.get("days")) || 7, 1), 365);
  const since = today(new Date(Date.now() - (days - 1) * 86400000));
  const [totals, stock, rescuedRevenue] = await Promise.all([outcomeTotals(since), listStock(), bundleRevenue(since)]);
  const atRisk = stock.filter((b) => ["today", "soon"].includes(freshness(b.expiresOn)));
  const expired = stock.filter((b) => freshness(b.expiresOn) === "expired");
  const costOf = (bs: typeof stock) => bs.reduce((s, b) => s + b.remaining * b.unitCost, 0);
  return Response.json({
    days,
    since,
    sold: totals.sold,
    wasted: totals.wasted,
    rescued: { ...totals.rescued, revenue: rescuedRevenue },
    atRisk: { batches: atRisk.length, cost: costOf(atRisk) },
    expired: { batches: expired.length, cost: costOf(expired) },
  });
}
