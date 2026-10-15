import type { BatchHistory } from "./db";
import { today } from "./schema";

// Turns past batches into "what we waste" and "what to order". Pure functions: no database access.

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type ItemInsight = {
  name: string;
  unit: string;
  batches: number;
  ordered: number;
  /** Sold at full price. */
  sold: number;
  /** Sold at a discount in rescue bundles. */
  rescued: number;
  /** Logged as wasted, plus anything left in a batch after it expired. */
  wasted: number;
  wasteCost: number;
  /** Share of what was ordered that didn't sell at full price. */
  leftoverRate: number;
};

export type OrderTip = {
  name: string;
  unit: string;
  avgOrder: number;
  suggested: number;
  /** Rough cost saved per 30 days at the suggested order size. */
  monthlySaving: number;
  reason: string;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** A batch is "closed" once it's used up or expired, so its outcome is final. */
const isClosed = (b: BatchHistory, day: string) => b.remaining <= 1e-9 || b.expiresOn < day;

/** Per-item totals over closed batches, most waste (at cost) first. */
export function itemInsights(history: BatchHistory[], day = today()): ItemInsight[] {
  const byItem = new Map<string, BatchHistory[]>();
  for (const b of history.filter((h) => isClosed(h, day))) {
    const key = b.name.trim().toLowerCase();
    byItem.set(key, [...(byItem.get(key) ?? []), b]);
  }
  return [...byItem.values()]
    .map((bs) => {
      const sum = (f: (b: BatchHistory) => number) => bs.reduce((s, b) => s + f(b), 0);
      // Stock still on the shelf after expiry was thrown away too, even if nobody logged it.
      const wastedQty = (b: BatchHistory) => b.wasted + Math.max(b.remaining, 0);
      const ordered = sum((b) => b.quantity);
      const sold = sum((b) => b.sold);
      return {
        name: bs.at(-1)!.name,
        unit: bs[0].unit,
        batches: bs.length,
        ordered: round1(ordered),
        sold: round1(sold),
        rescued: round1(sum((b) => b.rescued)),
        wasted: round1(sum(wastedQty)),
        wasteCost: sum((b) => wastedQty(b) * b.unitCost),
        leftoverRate: ordered ? 1 - sold / ordered : 0,
      };
    })
    .sort((a, b) => b.wasteCost - a.wasteCost);
}

/** The value below which `p` (0–1) of the sorted values fall. */
function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
}

/**
 * Suggests smaller orders for items that regularly don't sell at full price.
 * Target = what sold at full price on 80% of batches, so most days still don't run out.
 * Needs at least 3 closed batches of an item, and at least 15% leftover, to say anything.
 */
export function orderTips(history: BatchHistory[], day = today()): OrderTip[] {
  const closed = history.filter((h) => isClosed(h, day));
  const tips: OrderTip[] = [];
  for (const item of itemInsights(history, day)) {
    if (item.batches < 3 || item.leftoverRate < 0.15) continue;
    const bs = closed.filter((b) => b.name.trim().toLowerCase() === item.name.trim().toLowerCase());
    const avgOrder = item.ordered / item.batches;
    const step = item.unit === "pcs" || item.unit === "pack" ? 1 : 0.5;
    const suggested = Math.max(step, Math.ceil(percentile(bs.map((b) => b.sold), 0.8) / step) * step);
    if (suggested > avgOrder * 0.9) continue; // less than a 10% change isn't worth the advice

    // Saving per batch: the cut, but never more than what was actually left over.
    const avgLeftover = (item.ordered - item.sold) / item.batches;
    const avgCost = bs.reduce((s, b) => s + b.unitCost * b.quantity, 0) / item.ordered;
    const spanDays = Math.max(1, (Date.parse(day) - Date.parse(bs[0].addedOn)) / 86400000);
    const batchesPerMonth = (item.batches / spanDays) * 30;
    tips.push({
      name: item.name,
      unit: item.unit,
      avgOrder: round1(avgOrder),
      suggested,
      monthlySaving: Math.min(avgOrder - suggested, avgLeftover) * avgCost * batchesPerMonth,
      reason: `On average ${round1(item.sold / item.batches)} of ${round1(avgOrder)} sold at full price; ${Math.round(item.leftoverRate * 100)}% went to bundles or the bin. ${suggested} would have covered full-price demand on about 4 days in 5.`,
    });
  }
  return tips.sort((a, b) => b.monthlySaving - a.monthlySaving);
}

/** Waste at cost per weekday, Monday first, in the shop's local time. */
export function wasteByWeekday(waste: { at: string; cost: number }[]) {
  const totals = WEEKDAYS.map((day) => ({ day, cost: 0 }));
  for (const w of waste) totals[(new Date(w.at).getDay() + 6) % 7].cost += w.cost;
  return totals;
}
