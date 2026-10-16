import { createHash, randomInt } from "node:crypto";
import { z } from "zod";
import { availabilityOf } from "@/lib/availability";
import { activeCodes, countClientHolds, getBundle, getShopBySlug, insertReservation, transaction } from "@/lib/db";
import { readBody } from "@/lib/http";

type Ctx = { params: Promise<{ slug: string }> };

const HOLD_MINUTES = 60;
const MAX_HOLDS_PER_CUSTOMER = 2;

const Body = z.object({
  bundleId: z.string().min(1).max(40),
  name: z.string().trim().min(1, "Add your first name").max(40),
});

/** Who is asking, without storing their IP: a hash of it, salted with the shop id. */
function clientHash(req: Request, shopId: string) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  return createHash("sha256").update(`${shopId}:${ip}`).digest("base64url");
}

/** Public: a customer reserves one bundle for pickup within the hour and gets a 4-digit code. */
export async function POST(req: Request, { params }: Ctx) {
  const shop = await getShopBySlug((await params).slug);
  if (!shop) return Response.json({ error: "Shop not found" }, { status: 404 });
  const body = await readBody(req, Body);
  if (body instanceof Response) return body;
  const bundle = await getBundle(shop.id, body.bundleId);
  if (!bundle || bundle.status !== "active") return Response.json({ error: "Sorry, this deal has just ended." }, { status: 409 });

  const hash = clientHash(req, shop.id);
  const result = await transaction(async (tx) => {
    if ((await countClientHolds(shop.id, hash, tx)) >= MAX_HOLDS_PER_CUSTOMER) {
      return { error: `You can hold up to ${MAX_HOLDS_PER_CUSTOMER} deals at a time. Pick those up first.` };
    }
    if ((await availabilityOf(shop.id, [bundle], tx)).get(bundle.id)!.available < 1) {
      return { error: "Sorry, the last one was just taken." };
    }
    const used = await activeCodes(shop.id, tx);
    let code: string;
    do code = String(randomInt(1000, 10000));
    while (used.has(code));
    const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60000).toISOString();
    const id = await insertReservation(shop.id, { bundleId: bundle.id, customerName: body.name, code, clientHash: hash, expiresAt }, tx);
    return { id, code, expiresAt, title: bundle.title, price: bundle.price };
  });
  if ("error" in result) return Response.json(result, { status: 409 });
  return Response.json(result, { status: 201 });
}
