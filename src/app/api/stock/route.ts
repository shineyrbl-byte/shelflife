import { requireShop } from "@/lib/auth";
import { connection } from "next/server";
import { insertBatch, listStock, saveProduct } from "@/lib/db";
import { readBody } from "@/lib/http";
import { BarcodeSchema, BatchInputSchema, daysLeft, freshness } from "@/lib/schema";

export async function GET() {
  await connection();
  const shop = await requireShop();
  if (shop instanceof Response) return shop;
  return Response.json((await listStock(shop.id)).map((b) => ({ ...b, daysLeft: daysLeft(b.expiresOn), freshness: freshness(b.expiresOn) })));
}

const Body = BatchInputSchema.extend({ barcode: BarcodeSchema.optional() });

/** Adds a batch. With a barcode, also remembers the item so the next scan fills everything in. */
export async function POST(req: Request) {
  const shop = await requireShop();
  if (shop instanceof Response) return shop;
  const body = await readBody(req, Body);
  if (body instanceof Response) return body;
  const { barcode, ...batch } = body;
  const id = await insertBatch(shop.id, batch);
  if (barcode) await saveProduct(shop.id, { barcode, ...batch, shelfLifeDays: Math.max(0, daysLeft(batch.expiresOn)) });
  return Response.json({ id }, { status: 201 });
}
