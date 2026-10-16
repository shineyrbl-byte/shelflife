import { requireShop } from "@/lib/auth";
import { connection } from "next/server";
import { suggestBundles } from "@/lib/bundles";
import { listStock } from "@/lib/db";

export async function GET() {
  await connection();
  const shop = await requireShop();
  if (shop instanceof Response) return shop;
  return Response.json(suggestBundles(await listStock(shop.id)));
}
