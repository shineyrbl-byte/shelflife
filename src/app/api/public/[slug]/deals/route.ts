import { connection } from "next/server";
import { availabilityOf } from "@/lib/availability";
import { getShopBySlug, listActiveBundles } from "@/lib/db";
import { publicDealsUrl } from "@/lib/urls";

type Ctx = { params: Promise<{ slug: string }> };

/** Public: a shop's bundles on sale right now. Only customer-facing fields; no costs or stock ids. */
export async function GET(req: Request, { params }: Ctx) {
  await connection();
  const shop = await getShopBySlug((await params).slug);
  if (!shop) return Response.json({ error: "Shop not found" }, { status: 404 });
  const bundles = await listActiveBundles(shop.id);
  const avail = await availabilityOf(shop.id, bundles);
  const deals = bundles
    .map((b) => ({
      id: b.id,
      title: b.title,
      description: b.description,
      items: b.items.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
      originalPrice: b.originalPrice,
      price: b.price,
      expiresOn: b.expiresOn,
      available: avail.get(b.id)!.available,
    }))
    .filter((d) => d.available > 0);
  return Response.json({ shop: { name: shop.name, publicUrl: publicDealsUrl(req, shop.slug) }, deals });
}
