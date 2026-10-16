import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { insertSupplier } from "@/lib/db";
import { readBody } from "@/lib/http";
import { normalizePhone } from "@/lib/orders";

const Body = z.object({ name: z.string().trim().min(1, "Add the supplier's name").max(40), phone: z.string().max(30) });

/** Owner: add a supplier with their WhatsApp number. */
export async function POST(req: Request) {
  const session = await requireOwner();
  if (session instanceof Response) return session;
  const body = await readBody(req, Body);
  if (body instanceof Response) return body;
  const phone = normalizePhone(body.phone);
  if (!phone) return Response.json({ error: "Enter a WhatsApp number, e.g. 98765 43210 or +44 7700 900123." }, { status: 400 });
  return Response.json(await insertSupplier(session.shop.id, body.name, phone), { status: 201 });
}
