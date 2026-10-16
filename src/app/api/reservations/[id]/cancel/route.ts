import { requireShop } from "@/lib/auth";
import { getReservation, setReservationStatus } from "@/lib/db";
import { notFound } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

/** Staff: release a reservation (no-show, or the customer changed their mind). */
export async function POST(_req: Request, { params }: Ctx) {
  const shop = await requireShop();
  if (shop instanceof Response) return shop;
  const r = await getReservation(shop.id, (await params).id);
  if (!r) return notFound();
  if (r.status === "held") await setReservationStatus(shop.id, r.id, "cancelled");
  return new Response(null, { status: 204 });
}
