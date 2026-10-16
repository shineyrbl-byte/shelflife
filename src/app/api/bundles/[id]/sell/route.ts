import { requireShop } from "@/lib/auth";
import { availabilityOf } from "@/lib/availability";
import { getBundle, recordBundleSale, setBundleStatus, transaction } from "@/lib/db";
import { notFound } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Records one walk-in sale at the till. Checking stock and logging the sale happen in one transaction,
 * so it can't oversell, and bundles reserved by customers aren't sold to someone else.
 */
export async function POST(_req: Request, { params }: Ctx) {
  const shop = await requireShop();
  if (shop instanceof Response) return shop;
  const bundle = await getBundle(shop.id, (await params).id);
  if (!bundle) return notFound();
  if (bundle.status !== "active") return Response.json({ error: "This bundle is no longer on sale." }, { status: 409 });
  const result = await transaction(async (tx) => {
    const before = (await availabilityOf(shop.id, [bundle], tx)).get(bundle.id)!;
    if (before.available < 1) return { error: before.held ? "The rest are reserved by customers." : "Not enough stock left for this bundle." };
    await recordBundleSale(bundle, tx);
    const after = (await availabilityOf(shop.id, [bundle], tx)).get(bundle.id)!;
    if (after.fromStock < 1) await setBundleStatus(shop.id, bundle.id, "sold", tx);
    return { available: after.available };
  });
  if ("error" in result) return Response.json(result, { status: 409 });
  return Response.json(result);
}
