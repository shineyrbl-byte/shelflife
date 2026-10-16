import { connection } from "next/server";
import { countShops, rescueTotals } from "@/lib/db";
import { impactOf } from "@/lib/impact";

/** Public: totals across every shop, for the homepage counter. No per-shop data. */
export async function GET() {
  await connection();
  const [shops, totals] = await Promise.all([countShops(), rescueTotals(null)]);
  const { kgRescued, co2Kg, bundlesSold } = impactOf(totals.rows, totals.money, totals.bundlesSold);
  return Response.json({ shops, kgRescued, co2Kg, bundlesSold }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
