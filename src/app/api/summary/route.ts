import { connection } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { currentSession } from "@/lib/auth";
import { getShopBySlug } from "@/lib/db";
import { buildSummary } from "@/lib/summary";

const secretMatches = (given: string, secret: string) =>
  given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));

/**
 * The owner's daily summary as plain text. Staff get their own shop's; scripts can ask for
 * any shop with ?shop=<slug> and the header "Authorization: Bearer <CRON_SECRET>".
 */
export async function GET(req: Request) {
  await connection();
  const url = new URL(req.url);
  const appUrl = process.env.APP_URL || url.origin;
  const session = await currentSession();
  if (session) return Response.json(await buildSummary(session.shop, appUrl));

  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || !secretMatches(given, secret)) return Response.json({ error: "Please log in again." }, { status: 401 });
  const shop = await getShopBySlug(url.searchParams.get("shop") ?? "");
  if (!shop) return Response.json({ error: "No shop with that name. Pass ?shop=<your shop's link name>." }, { status: 404 });
  return Response.json(await buildSummary(shop, appUrl));
}
