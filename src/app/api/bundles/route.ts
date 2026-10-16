import { requireShop } from "@/lib/auth";
import { connection } from "next/server";
import { z } from "zod";
import { ensureAlertsTopic, getBatches, insertBundle, listActiveBundles } from "@/lib/db";
import { pushDealAlert } from "@/lib/notify";
import { expiryLabel, rupees } from "@/lib/schema";
import { publicDealsUrl } from "@/lib/urls";
import { readBody } from "@/lib/http";
import { availabilityOf } from "@/lib/availability";
import type { Batch } from "@/lib/schema";

export async function GET() {
  await connection();
  const shop = await requireShop();
  if (shop instanceof Response) return shop;
  const bundles = await listActiveBundles(shop.id);
  // Live availability: what the remaining stock can make, minus customers' reservations.
  const avail = await availabilityOf(shop.id, bundles);
  return Response.json(bundles.map((b) => ({ ...b, ...avail.get(b.id)! })));
}

const Body = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(300),
  items: z.array(z.object({ batchId: z.string(), quantity: z.number().positive() })).min(1).max(5),
  price: z.number().positive(),
});

/** Publishes a bundle (usually an accepted suggestion, possibly with edited copy or price). */
export async function POST(req: Request) {
  const shop = await requireShop();
  if (shop instanceof Response) return shop;
  const body = await readBody(req, Body);
  if (body instanceof Response) return body;
  const stock = await getBatches(shop.id, body.items.map((i) => i.batchId));
  const found = body.items.map((i) => stock.get(i.batchId));
  if (found.some((b) => !b)) return Response.json({ error: "An item in this bundle no longer exists." }, { status: 400 });
  const batches = found as Batch[];
  // Prices and expiry come from the stock records, not the client.
  const originalPrice = batches.reduce((s, b, i) => s + b.unitPrice * body.items[i].quantity, 0);
  if (body.price > originalPrice) return Response.json({ error: "The bundle price is higher than buying the items separately." }, { status: 400 });
  const id = await insertBundle(shop.id, {
    title: body.title,
    description: body.description,
    items: batches.map((b, i) => ({ batchId: b.id, name: b.name, quantity: body.items[i].quantity, unit: b.unit })),
    originalPrice,
    price: body.price,
    expiresOn: batches.map((b) => b.expiresOn).sort()[0],
  });
  if (shop.dealAlerts) {
    // Tell customers who follow the shop. A failed alert never blocks publishing.
    try {
      await pushDealAlert(await ensureAlertsTopic(shop), {
        title: `New deal at ${shop.name}`,
        message: `${body.title}: ${rupees(body.price)} (was ${rupees(originalPrice)}), until ${expiryLabel(batches.map((b) => b.expiresOn).sort()[0])}. Reserve it before it's gone!`,
        clickUrl: publicDealsUrl(req, shop.slug),
      });
    } catch (err) {
      console.error("deal alert failed", err);
    }
  }
  return Response.json({ id }, { status: 201 });
}
