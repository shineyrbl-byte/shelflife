import type { Category, Unit } from "./schema";

// Turns rescued stock into the numbers people care about: kilograms of food and CO2 avoided.
// Both are estimates, and every place that shows them says so.

/** Typical weight of one piece or pack, by category, for items not sold by weight or volume. */
const KG_PER_PIECE: Record<Category, number> = {
  bakery: 0.08, // a croissant or slice of cake
  prepared: 0.25, // a wrap or sandwich
  beverages: 0.3, // a bottle
  dairy: 0.2, // a yoghurt cup or butter pack
  produce: 0.15, // a piece of fruit
  packaged: 0.2,
};

/**
 * About 2.5 kg CO2-equivalent per kg of food wasted: the global average footprint of food waste
 * (FAO, "Food Wastage Footprint"), rounded. Real values vary a lot by food type.
 */
export const CO2_PER_KG_FOOD = 2.5;

export function weightKg(unit: Unit, category: Category, quantity: number) {
  if (unit === "kg") return quantity;
  if (unit === "L") return quantity; // close enough for drinks and milk
  return quantity * KG_PER_PIECE[category];
}

export type Impact = { kgRescued: number; co2Kg: number; moneyRecovered: number; bundlesSold: number };

export function impactOf(rows: { unit: Unit; category: Category; quantity: number }[], money: number, bundlesSold: number): Impact {
  const kg = rows.reduce((s, r) => s + weightKg(r.unit, r.category, r.quantity), 0);
  return { kgRescued: Math.round(kg * 10) / 10, co2Kg: Math.round(kg * CO2_PER_KG_FOOD), moneyRecovered: Math.round(money), bundlesSold };
}
