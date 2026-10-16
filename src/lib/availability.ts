import { bundlesAvailable } from "./bundles";
import { getBatches, holdsByBundle, type Db } from "./db";
import type { Bundle } from "./schema";

export type Availability = { fromStock: number; held: number; available: number };

/**
 * How many of each bundle can still be sold: what the remaining stock can make,
 * minus customers' active reservations. `exceptReservation` leaves one hold out (when collecting it).
 */
export async function availabilityOf(
  shopId: string,
  bundles: Pick<Bundle, "id" | "items">[],
  db?: Db,
  exceptReservation = "",
): Promise<Map<string, Availability>> {
  const [stock, holds] = await Promise.all([
    getBatches(shopId, [...new Set(bundles.flatMap((b) => b.items.map((i) => i.batchId)))], db),
    holdsByBundle(shopId, db, exceptReservation),
  ]);
  return new Map(
    bundles.map((b) => {
      const fromStock = bundlesAvailable(b.items.map((i) => ({ quantity: i.quantity, remaining: stock.get(i.batchId)?.remaining ?? 0 })));
      const held = holds.get(b.id) ?? 0;
      return [b.id, { fromStock, held, available: Math.max(0, fromStock - held) }];
    }),
  );
}
