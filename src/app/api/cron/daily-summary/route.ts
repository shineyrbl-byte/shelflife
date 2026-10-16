import { connection } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { listShopsWithNtfy } from "@/lib/db";
import { pushSummary } from "@/lib/notify";
import { buildSummary } from "@/lib/summary";

/**
 * Sends every shop that set an ntfy topic its morning summary. Called once a day by Vercel Cron
 * (see vercel.json), which sends "Authorization: Bearer $CRON_SECRET" automatically.
 */
export async function GET(req: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const appUrl = process.env.APP_URL || new URL(req.url).origin;
  const shops = await listShopsWithNtfy();
  let sent = 0;
  const failed: string[] = [];
  // One at a time: a handful of shops, and it keeps ntfy's rate limits happy.
  for (const shop of shops) {
    try {
      await pushSummary(shop.ntfyTopic!, await buildSummary(shop, appUrl), `${appUrl}/bundles`);
      sent++;
    } catch (err) {
      console.error(`daily summary failed for ${shop.slug}`, err);
      failed.push(shop.slug);
    }
  }
  return Response.json({ shops: shops.length, sent, failed });
}
