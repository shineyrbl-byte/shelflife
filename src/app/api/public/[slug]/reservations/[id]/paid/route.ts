import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getReservation, getShopBySlug, markUpiClaimed } from "@/lib/db";
import { readBody } from "@/lib/http";

type Ctx = { params: Promise<{ slug: string; id: string }> };

const Body = z.object({ code: z.string().regex(/^\d{4}$/) });

/**
 * Public: the customer says they've paid for their reservation by UPI. Needs the reservation's id
 * and code, which only their browser has. This is a claim, not proof: staff check their UPI app.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { slug, id } = await params;
  const shop = await getShopBySlug(slug);
  const body = await readBody(req, Body);
  if (body instanceof Response) return body;
  const r = shop && (await getReservation(shop.id, id));
  if (!shop || !r || !timingSafeEqual(Buffer.from(r.code), Buffer.from(body.code))) {
    return Response.json({ error: "Reservation not found." }, { status: 404 });
  }
  if (r.status !== "held") return Response.json({ error: "This reservation is no longer open." }, { status: 409 });
  await markUpiClaimed(shop.id, r.id);
  return new Response(null, { status: 204 });
}
