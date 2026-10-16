import { connection } from "next/server";
import { hashToken } from "@/lib/auth";
import { findValidToken, getShop } from "@/lib/db";

/** Public: which shop an invite link is for, so the join page can say so. */
export async function GET(req: Request) {
  await connection();
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const invite = token ? await findValidToken(hashToken(token), "invite") : null;
  const shop = invite && (await getShop(invite.shopId));
  if (!shop) return Response.json({ error: "This invite link has expired or was already used. Ask the shop owner for a new one." }, { status: 404 });
  return Response.json({ shop: { name: shop.name } });
}
