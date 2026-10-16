import { deleteBatch, getBatch, updateBatch } from "@/lib/db";
import { notFound, readBody } from "@/lib/http";
import { BatchInputSchema } from "@/lib/schema";

type Ctx = { params: Promise<{ id: string }> };

/** Corrects a batch (typo, price, expiry, miscounted quantity). Logged history stays valid. */
export async function PATCH(req: Request, { params }: Ctx) {
  const batch = await getBatch((await params).id);
  if (!batch) return notFound();
  const body = await readBody(req, BatchInputSchema.partial());
  if (body instanceof Response) return body;
  const next = { ...batch, ...body };

  const logged = batch.quantity - batch.remaining;
  if (logged > 0 && next.unit !== batch.unit) {
    return Response.json({ error: "Can't change the unit after sales or waste were logged." }, { status: 409 });
  }
  if (next.quantity < logged - 1e-9) {
    return Response.json({ error: `Quantity can't be below the ${+logged.toFixed(2)} ${batch.unit} already sold, rescued or wasted.` }, { status: 409 });
  }
  const parsed = BatchInputSchema.safeParse(next);
  if (!parsed.success) return Response.json({ error: "Invalid values." }, { status: 400 });
  await updateBatch(batch.id, parsed.data);
  return Response.json(await getBatch(batch.id));
}

/** Removes a batch entered by mistake, along with its history. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!(await getBatch(id))) return notFound();
  await deleteBatch(id);
  return new Response(null, { status: 204 });
}
