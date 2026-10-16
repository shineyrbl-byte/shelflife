import { requireShop } from "@/lib/auth";
import { connection } from "next/server";
import { notYetLive, suggestBundles } from "@/lib/bundles";
import { listActiveBundles, listStock } from "@/lib/db";

export async function GET() {
  await connection();
  const shop = await requireShop();
  if (shop instanceof Response) return shop;
  const [stock, live] = await Promise.all([listStock(shop.id), listActiveBundles(shop.id)]);
  return Response.json(notYetLive(suggestBundles(stock), live));
}
