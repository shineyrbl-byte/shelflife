import { z } from "zod";
import { insertBatch, transaction } from "@/lib/db";
import { readBody } from "@/lib/http";
import { BatchInputSchema } from "@/lib/schema";

const Body = z.object({ items: z.array(BatchInputSchema).min(1).max(100) });

/** Adds several batches at once (e.g. a scanned bill): all of them or none. */
export async function POST(req: Request) {
  const body = await readBody(req, Body);
  if (body instanceof Response) return body;
  const ids = transaction(() => body.items.map((item) => insertBatch(item)));
  return Response.json({ ids }, { status: 201 });
}
