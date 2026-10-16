import type { BatchHistory } from "../db";
import type { Batch } from "../schema";

/** A batch for tests; everything not given gets a sensible default. */
export function batch(over: Partial<Batch> & { id: string }): Batch {
  return {
    name: over.id,
    category: "bakery",
    unit: "pcs",
    quantity: 10,
    remaining: over.remaining ?? over.quantity ?? 10,
    unitCost: 20,
    unitPrice: 60,
    expiresOn: "2026-10-16",
    addedOn: "2026-10-10",
    ...over,
  };
}

export function history(over: Partial<BatchHistory> & { id: string }): BatchHistory {
  return { sold: 0, rescued: 0, wasted: 0, donated: 0, ...batch({ remaining: 0, ...over }), ...over } as BatchHistory;
}
