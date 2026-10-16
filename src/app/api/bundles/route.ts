import { connection } from "next/server";
import { z } from "zod";
import { bundlesAvailable } from "@/lib/bundles";
import { getBatches, insertBundle, listActiveBundles } from "@/lib/db";
import { readBody } from "@/lib/http";
import type { Batch } from "@/lib/schema";

export async function GET() {
  await connection();
  const bundles = await listActiveBundles();
  const stock = await getBatches([...new Set(bundles.flatMap((b) => b.items.map((i) => i.batchId)))]);
  // Live availability: how many more of each bundle the remaining stock can make.
  return Response.json(
    bundles.map((b) => ({
      ...b,
      available: bundlesAvailable(b.items.map((i) => ({ quantity: i.quantity, remaining: stock.get(i.batchId)?.remaining ?? 0 }))),
    })),
  );
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
  const stock = await getBatches(body.items.map((i) => i.batchId));
  const found = body.items.map((i) => stock.get(i.batchId));
  if (found.some((b) => !b)) return Response.json({ error: "An item in this bundle no longer exists." }, { status: 400 });
  const batches = found as Batch[];
  // Prices and expiry come from the stock records, not the client.
  const originalPrice = batches.reduce((s, b, i) => s + b.unitPrice * body.items[i].quantity, 0);
  if (body.price > originalPrice) return Response.json({ error: "The bundle price is higher than buying the items separately." }, { status: 400 });
  const id = await insertBundle({
    title: body.title,
    description: body.description,
    items: batches.map((b, i) => ({ batchId: b.id, name: b.name, quantity: body.items[i].quantity, unit: b.unit })),
    originalPrice,
    price: body.price,
    expiresOn: batches.map((b) => b.expiresOn).sort()[0],
  });
  return Response.json({ id }, { status: 201 });
}
