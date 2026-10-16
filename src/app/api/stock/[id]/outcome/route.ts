import { requireShop } from "@/lib/auth";
import { z } from "zod";
import { getBatch, logOutcome } from "@/lib/db";
import { notFound, readBody } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

// "rescued" is only logged by selling a bundle, so it isn't accepted here.
const Body = z.object({ outcome: z.enum(["sold", "wasted"]), quantity: z.number().positive() });

export async function POST(req: Request, { params }: Ctx) {
  const shop = await requireShop();
  if (shop instanceof Response) return shop;
  const batch = await getBatch(shop.id, (await params).id);
  if (!batch) return notFound();
  const body = await readBody(req, Body);
  if (body instanceof Response) return body;
  if (body.quantity > batch.remaining + 1e-9) {
    return Response.json({ error: `Only ${batch.remaining} ${batch.unit} left.` }, { status: 409 });
  }
  await logOutcome(batch.id, body.outcome, body.quantity);
  return Response.json(await getBatch(shop.id, batch.id));
}
