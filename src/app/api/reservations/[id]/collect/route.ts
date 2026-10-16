import { requireShop } from "@/lib/auth";
import { availabilityOf } from "@/lib/availability";
import { getBundle, getReservation, recordBundleSale, setBundleStatus, setReservationStatus, transaction } from "@/lib/db";
import { notFound } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

/** Staff: the customer picked up their reservation. Records the sale, like "Sold 1", in one transaction. */
export async function POST(_req: Request, { params }: Ctx) {
  const shop = await requireShop();
  if (shop instanceof Response) return shop;
  const r = await getReservation(shop.id, (await params).id);
  if (!r) return notFound();
  if (r.status !== "held") return Response.json({ error: `This reservation was already ${r.status}.` }, { status: 409 });
  const bundle = await getBundle(shop.id, r.bundleId);
  if (!bundle) return notFound();

  const result = await transaction(async (tx) => {
    // This reservation's own hold doesn't count against it; a late customer can still collect if stock is left.
    const before = (await availabilityOf(shop.id, [bundle], tx, r.id)).get(bundle.id)!;
    if (before.available < 1) return { error: "No stock left for this bundle. Offer something else or cancel the reservation." };
    await recordBundleSale(bundle, tx);
    await setReservationStatus(shop.id, r.id, "collected", tx);
    const after = (await availabilityOf(shop.id, [bundle], tx)).get(bundle.id)!;
    if (after.fromStock < 1) await setBundleStatus(shop.id, bundle.id, "sold", tx);
    return { ok: true };
  });
  if ("error" in result) return Response.json(result, { status: 409 });
  return Response.json(result);
}
