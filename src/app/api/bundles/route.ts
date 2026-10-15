import { connection } from "next/server";
import { z } from "zod";
import { bundlesAvailable } from "@/lib/bundles";
import { getBatch, insertBundle, listActiveBundles } from "@/lib/db";
import { readBody } from "@/lib/http";
import type { Batch, Bundle } from "@/lib/schema";

/** Adds live availability: how many more of the bundle the remaining stock can make. */
function withAvailability(b: Bundle) {
  const items = b.items.map((i) => ({ quantity: i.quantity, remaining: getBatch(i.batchId)?.remaining ?? 0 }));
  return { ...b, available: bundlesAvailable(items) };
}

export async function GET() {
  await connection();
  return Response.json(listActiveBundles().map(withAvailability));
}

const Body = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(300),
  items: z.array(z.object({ batchId: z.string(), quantity: z.number().positive() })).min(1).max(5),
  price: z.number().positive(),
});

/** Publishes a bundle (usually an accepted suggestion, possibly with edited copy or price). */
export async function POST(req: Request) {
  const body = await readBody(req, Body);
  if (body instanceof Response) return body;
  const batches = body.items.map((i) => getBatch(i.batchId));
  if (batches.some((b) => !b)) return Response.json({ error: "An item in this bundle no longer exists." }, { status: 400 });
  const found = batches as Batch[];
  // Prices and expiry come from the stock records, not the client.
  const originalPrice = found.reduce((s, b, i) => s + b.unitPrice * body.items[i].quantity, 0);
  if (body.price > originalPrice) return Response.json({ error: "The bundle price is higher than buying the items separately." }, { status: 400 });
  const id = insertBundle({
    title: body.title,
    description: body.description,
    items: found.map((b, i) => ({ batchId: b.id, name: b.name, quantity: body.items[i].quantity, unit: b.unit })),
    originalPrice,
    price: body.price,
    expiresOn: found.map((b) => b.expiresOn).sort()[0],
  });
  return Response.json({ id }, { status: 201 });
}
