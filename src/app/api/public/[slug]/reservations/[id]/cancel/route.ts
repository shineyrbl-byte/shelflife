import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getReservation, getShopBySlug, setReservationStatus } from "@/lib/db";
import { readBody } from "@/lib/http";

type Ctx = { params: Promise<{ slug: string; id: string }> };

const Body = z.object({ code: z.string().regex(/^\d{4}$/) });

/** Public: a customer cancels their own reservation. Needs its id and pickup code, which only they have. */
export async function POST(req: Request, { params }: Ctx) {
  const { slug, id } = await params;
  const shop = await getShopBySlug(slug);
  const body = await readBody(req, Body);
  if (body instanceof Response) return body;
  const r = shop && (await getReservation(shop.id, id));
  if (!shop || !r || !timingSafeEqual(Buffer.from(r.code), Buffer.from(body.code))) {
    return Response.json({ error: "Reservation not found." }, { status: 404 });
  }
  // Once a customer says they've paid, only the shop can cancel, so the refund isn't forgotten.
  if (r.upiClaimed) return Response.json({ error: "You've paid for this, so please ask the shop to cancel it and refund you." }, { status: 409 });
  if (r.status === "held") await setReservationStatus(shop.id, r.id, "cancelled");
  return new Response(null, { status: 204 });
}
