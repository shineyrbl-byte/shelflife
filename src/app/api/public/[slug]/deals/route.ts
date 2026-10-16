import { connection } from "next/server";
import { bundlesAvailable } from "@/lib/bundles";
import { getBatches, getShopBySlug, listActiveBundles } from "@/lib/db";

type Ctx = { params: Promise<{ slug: string }> };

/** Public: a shop's bundles on sale right now. Only customer-facing fields; no costs or stock ids. */
export async function GET(_req: Request, { params }: Ctx) {
  await connection();
  const shop = await getShopBySlug((await params).slug);
  if (!shop) return Response.json({ error: "Shop not found" }, { status: 404 });
  const bundles = await listActiveBundles(shop.id);
  const stock = await getBatches(shop.id, [...new Set(bundles.flatMap((b) => b.items.map((i) => i.batchId)))]);
  const deals = bundles
    .map((b) => ({
      id: b.id,
      title: b.title,
      description: b.description,
      items: b.items.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
      originalPrice: b.originalPrice,
      price: b.price,
      expiresOn: b.expiresOn,
      available: bundlesAvailable(b.items.map((i) => ({ quantity: i.quantity, remaining: stock.get(i.batchId)?.remaining ?? 0 }))),
    }))
    .filter((d) => d.available > 0);
  return Response.json({ shop: { name: shop.name }, deals });
}
