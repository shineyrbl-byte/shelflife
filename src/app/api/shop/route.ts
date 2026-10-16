import { connection } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { getShop, updateShop } from "@/lib/db";
import { readBody } from "@/lib/http";
import { NTFY_TOPIC_PATTERN } from "@/lib/notify";
import { publicDealsUrl } from "@/lib/urls";
import { UPI_ID_PATTERN } from "@/lib/upi";

export async function GET(req: Request) {
  await connection();
  const session = await requireOwner();
  if (session instanceof Response) return session;
  const { shop } = session;
  return Response.json({ name: shop.name, slug: shop.slug, ntfyTopic: shop.ntfyTopic, dealAlerts: shop.dealAlerts, upiId: shop.upiId, publicUrl: publicDealsUrl(req, shop.slug) });
}

const Body = z.object({
  name: z.string().trim().min(2, "Shop name is too short").max(60).optional(),
  // Empty string turns phone notifications off.
  ntfyTopic: z
    .string()
    .trim()
    .refine((t) => t === "" || NTFY_TOPIC_PATTERN.test(t), "Use 12–64 letters, numbers, - or _ so it's hard to guess")
    .optional(),
  dealAlerts: z.boolean().optional(),
  // Empty string turns UPI pre-payment off.
  upiId: z
    .string()
    .trim()
    .refine((v) => v === "" || UPI_ID_PATTERN.test(v), "That doesn't look like a UPI ID (e.g. yourcafe@okhdfcbank)")
    .optional(),
});

/** Shop settings. The link name (slug) stays fixed so printed QR posters keep working. */
export async function PATCH(req: Request) {
  const session = await requireOwner();
  if (session instanceof Response) return session;
  const { shop } = session;
  const body = await readBody(req, Body);
  if (body instanceof Response) return body;
  await updateShop(shop.id, { name: body.name, dealAlerts: body.dealAlerts, upiId: body.upiId === undefined ? undefined : body.upiId || null, ntfyTopic: body.ntfyTopic === undefined ? undefined : body.ntfyTopic || null });
  const updated = await getShop(shop.id);
  return Response.json({ name: updated!.name, slug: updated!.slug, ntfyTopic: updated!.ntfyTopic, dealAlerts: updated!.dealAlerts, upiId: updated!.upiId, publicUrl: publicDealsUrl(req, updated!.slug) });
}
