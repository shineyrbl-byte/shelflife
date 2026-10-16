import { requireShop } from "@/lib/auth";
import { bundlesAvailable } from "@/lib/bundles";
import { getBatches, getBundle, recordBundleSale, setBundleStatus, transaction, type Db } from "@/lib/db";
import { notFound } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

async function remainingOf(shopId: string, items: { batchId: string; quantity: number }[], db: Db) {
  const stock = await getBatches(shopId, items.map((i) => i.batchId), db);
  return bundlesAvailable(items.map((i) => ({ quantity: i.quantity, remaining: stock.get(i.batchId)?.remaining ?? 0 })));
}

/** Records one bundle sale. Checking stock and logging the sale happen in one transaction, so it can't oversell. */
export async function POST(_req: Request, { params }: Ctx) {
  const shop = await requireShop();
  if (shop instanceof Response) return shop;
  const bundle = await getBundle(shop.id, (await params).id);
  if (!bundle) return notFound();
  if (bundle.status !== "active") return Response.json({ error: "This bundle is no longer on sale." }, { status: 409 });
  const result = await transaction(async (tx) => {
    if ((await remainingOf(shop.id, bundle.items, tx)) < 1) return null;
    await recordBundleSale(bundle, tx);
    const left = await remainingOf(shop.id, bundle.items, tx);
    if (left < 1) await setBundleStatus(shop.id, bundle.id, "sold", tx);
    return left;
  });
  if (result === null) return Response.json({ error: "Not enough stock left for this bundle." }, { status: 409 });
  return Response.json({ available: result });
}
