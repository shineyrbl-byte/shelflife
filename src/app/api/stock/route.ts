import { requireShop } from "@/lib/auth";
import { connection } from "next/server";
import { insertBatch, listStock } from "@/lib/db";
import { readBody } from "@/lib/http";
import { BatchInputSchema, daysLeft, freshness } from "@/lib/schema";

export async function GET() {
  await connection();
  const shop = await requireShop();
  if (shop instanceof Response) return shop;
  return Response.json((await listStock(shop.id)).map((b) => ({ ...b, daysLeft: daysLeft(b.expiresOn), freshness: freshness(b.expiresOn) })));
}

export async function POST(req: Request) {
  const shop = await requireShop();
  if (shop instanceof Response) return shop;
  const body = await readBody(req, BatchInputSchema);
  if (body instanceof Response) return body;
  return Response.json({ id: await insertBatch(shop.id, body) }, { status: 201 });
}
