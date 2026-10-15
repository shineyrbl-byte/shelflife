import { daysLeft, expiryLabel, freshness, today, type Batch, type BundleItem, type Category } from "./schema";

// Rule-based rescue bundles: pair near-expiry items that people buy together,
// discount them by urgency, and never price below what the stock cost the shop.

/** How much of each unit goes into one bundle. */
const PORTION: Record<Batch["unit"], number> = { pcs: 1, pack: 1, kg: 0.25, L: 0.5 };

/** Discount by days left: the closer to expiry, the bigger the discount. */
const DISCOUNT_BY_DAYS = [0.5, 0.4, 0.3];

// Categories that make sense together, and what to call the combo.
const PAIRS: { a: Category; b: Category; label: string }[] = [
  { a: "bakery", b: "beverages", label: "Breakfast rescue" },
  { a: "bakery", b: "dairy", label: "Morning bundle" },
  { a: "prepared", b: "beverages", label: "Lunch combo" },
  { a: "produce", b: "dairy", label: "Fresh basket" },
  { a: "prepared", b: "bakery", label: "Snack box" },
  { a: "produce", b: "prepared", label: "Healthy combo" },
];

export type BundleSuggestion = {
  title: string;
  description: string;
  items: BundleItem[];
  originalPrice: number;
  price: number;
  discountPct: number;
  expiresOn: string;
  /** How many of this bundle the current stock can make. */
  available: number;
};

const roundTo5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

/** Number of bundles that can be made from the batches' remaining stock. */
export function bundlesAvailable(items: { quantity: number; remaining: number }[]) {
  return Math.min(...items.map((i) => Math.floor(i.remaining / i.quantity + 1e-9)));
}

function priceBundle(batches: Batch[], from: string) {
  const portions = batches.map((b) => PORTION[b.unit]);
  const original = batches.reduce((s, b, i) => s + b.unitPrice * portions[i], 0);
  const cost = batches.reduce((s, b, i) => s + b.unitCost * portions[i], 0);
  const soonest = Math.min(...batches.map((b) => daysLeft(b.expiresOn, from)));
  const discount = DISCOUNT_BY_DAYS[Math.max(0, soonest)] ?? 0.3;
  // Recover at least the cost, but stay below the normal price so it's still a deal.
  const price = Math.min(roundTo5(Math.max(original * (1 - discount), cost)), original);
  return { original, price, portions };
}

function suggestion(batches: Batch[], label: string, from: string): BundleSuggestion | null {
  const { original, price, portions } = priceBundle(batches, from);
  if (price >= original) return null; // no room for a discount without selling at a loss
  const items = batches.map((b, i) => ({ batchId: b.id, name: b.name, quantity: portions[i], unit: b.unit }));
  const available = bundlesAvailable(batches.map((b, i) => ({ quantity: portions[i], remaining: b.remaining })));
  if (available < 1) return null;
  const names = batches.map((b) => b.name);
  const expiresOn = batches.map((b) => b.expiresOn).sort()[0];
  return {
    title: `${label}: ${names.join(" + ")}`,
    description: `${names.join(" and ")} at ${Math.round((1 - price / original) * 100)}% off. Best enjoyed ${daysLeft(expiresOn, from) === 0 ? "today" : "by " + expiryLabel(expiresOn, from)}.`,
    items,
    originalPrice: original,
    price,
    discountPct: Math.round((1 - price / original) * 100),
    expiresOn,
    available,
  };
}

/**
 * Suggests rescue bundles for stock expiring within 2 days.
 * Each at-risk batch is used once: paired with the most urgent complementary item
 * (which may itself be fresh stock) or, failing that, offered on its own.
 */
export function suggestBundles(stock: Batch[], from = today()): BundleSuggestion[] {
  const atRisk = stock
    .filter((b) => b.remaining > 0 && ["today", "soon"].includes(freshness(b.expiresOn, from)))
    // Most urgent first; among equals, the most money at stake first.
    .sort((x, y) => x.expiresOn.localeCompare(y.expiresOn) || y.remaining * y.unitCost - x.remaining * x.unitCost);

  const used = new Set<string>();
  const out: BundleSuggestion[] = [];

  for (const batch of atRisk) {
    if (used.has(batch.id)) continue;
    let made: BundleSuggestion | null = null;
    for (const pair of PAIRS) {
      const other = batch.category === pair.a ? pair.b : batch.category === pair.b ? pair.a : null;
      if (!other) continue;
      // Prefer a partner that is also at risk (rescues two items at once), then any stock.
      const partner = [...atRisk, ...stock].find(
        (p) => p.id !== batch.id && !used.has(p.id) && p.category === other && p.remaining > 0 && freshness(p.expiresOn, from) !== "expired",
      );
      if (!partner) continue;
      made = suggestion([batch, partner], pair.label, from);
      if (made) {
        if (atRisk.includes(partner)) used.add(partner.id);
        break;
      }
    }
    made ??= suggestion([batch], "Last-chance deal", from);
    used.add(batch.id);
    if (made) out.push(made);
  }
  return out;
}
