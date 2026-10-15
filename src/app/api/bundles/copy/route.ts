import { ApiError } from "@google/genai";
import { z } from "zod";
import { aiEnabled, writeBundleCopy } from "@/lib/ai";
import { getBatch } from "@/lib/db";
import { readBody } from "@/lib/http";
import type { Batch } from "@/lib/schema";

const Body = z.object({
  items: z.array(z.object({ batchId: z.string(), quantity: z.number().positive() })).min(1).max(5),
  price: z.number().positive(),
});

/** Writes a name and description for a bundle with AI. Contents and prices come from stock records. */
export async function POST(req: Request) {
  if (!aiEnabled()) {
    return Response.json({ error: "AI copy is off. Add a free GEMINI_API_KEY to .env.local to turn it on." }, { status: 501 });
  }
  const body = await readBody(req, Body);
  if (body instanceof Response) return body;
  const batches = body.items.map((i) => getBatch(i.batchId));
  if (batches.some((b) => !b)) return Response.json({ error: "An item in this bundle no longer exists." }, { status: 400 });
  const found = batches as Batch[];
  try {
    const copy = await writeBundleCopy({
      items: found.map((b, i) => ({ name: b.name, quantity: body.items[i].quantity, unit: b.unit })),
      price: body.price,
      originalPrice: found.reduce((s, b, i) => s + b.unitPrice * body.items[i].quantity, 0),
      expiresOn: found.map((b) => b.expiresOn).sort()[0],
      shop: process.env.NEXT_PUBLIC_SHOP_NAME,
    });
    return Response.json(copy);
  } catch (err) {
    console.error("bundle copy failed", err);
    const busy = err instanceof ApiError && [429, 500, 503].includes(err.status);
    return Response.json(
      { error: busy ? "Google's AI is busy right now. Try again in a minute." : "Couldn't write the copy. Please try again." },
      { status: busy ? 503 : 502 },
    );
  }
}
