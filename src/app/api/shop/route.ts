import { connection } from "next/server";
import { z } from "zod";
import { requireShop } from "@/lib/auth";
import { getShop, updateShop } from "@/lib/db";
import { readBody } from "@/lib/http";
import { NTFY_TOPIC_PATTERN } from "@/lib/notify";
import { publicDealsUrl } from "@/lib/urls";

export async function GET(req: Request) {
  await connection();
  const shop = await requireShop();
  if (shop instanceof Response) return shop;
  return Response.json({ name: shop.name, slug: shop.slug, ntfyTopic: shop.ntfyTopic, publicUrl: publicDealsUrl(req, shop.slug) });
}

const Body = z.object({
  name: z.string().trim().min(2, "Shop name is too short").max(60).optional(),
  // Empty string turns phone notifications off.
  ntfyTopic: z
    .string()
    .trim()
    .refine((t) => t === "" || NTFY_TOPIC_PATTERN.test(t), "Use 12–64 letters, numbers, - or _ so it's hard to guess")
    .optional(),
});

/** Shop settings. The link name (slug) stays fixed so printed QR posters keep working. */
export async function PATCH(req: Request) {
  const shop = await requireShop();
  if (shop instanceof Response) return shop;
  const body = await readBody(req, Body);
  if (body instanceof Response) return body;
  await updateShop(shop.id, { name: body.name, ntfyTopic: body.ntfyTopic === undefined ? undefined : body.ntfyTopic || null });
  const updated = await getShop(shop.id);
  return Response.json({ name: updated!.name, slug: updated!.slug, ntfyTopic: updated!.ntfyTopic, publicUrl: publicDealsUrl(req, updated!.slug) });
}
