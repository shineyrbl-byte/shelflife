import { connection } from "next/server";
import { requireShop } from "@/lib/auth";
import { listOpenReservations } from "@/lib/db";

/** Staff: reservations waiting for pickup (and ones that expired in the last day). */
export async function GET() {
  await connection();
  const shop = await requireShop();
  if (shop instanceof Response) return shop;
  const now = new Date().toISOString();
  return Response.json((await listOpenReservations(shop.id)).map((r) => ({ ...r, expired: r.expiresAt <= now })));
}
