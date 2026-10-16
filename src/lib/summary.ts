import { suggestBundles } from "./bundles";
import { bundleRevenue, listActiveBundles, listStock, outcomeTotals, type Shop } from "./db";
import { daysLeft, freshness, rupees, today, type Batch } from "./schema";

// The owner's morning summary: what expires today and tomorrow, what's already expired,
// what's on sale, and how the last week went. Plain text so it works in WhatsApp, push or email.

const qty = (b: Batch) => `${b.name} ×${+b.remaining.toFixed(2)}${b.unit === "pcs" ? "" : " " + b.unit}`;
const costOf = (bs: Batch[]) => bs.reduce((s, b) => s + b.remaining * b.unitCost, 0);

function section(icon: string, label: string, batches: Batch[], suffix = "") {
  if (!batches.length) return null;
  return `${icon} ${label} (${rupees(costOf(batches))} at cost${suffix}):\n${batches.map((b) => `  • ${qty(b)}`).join("\n")}`;
}

export async function buildSummary(shop: Shop, appUrl: string, now = new Date()) {
  const day = today(now);
  const since = today(new Date(now.getTime() - 6 * 86400000));
  const [stock, live, totals, rescued] = await Promise.all([listStock(shop.id), listActiveBundles(shop.id), outcomeTotals(shop.id, since), bundleRevenue(shop.id, since)]);
  const expiringToday = stock.filter((b) => freshness(b.expiresOn, day) === "today");
  const tomorrow = stock.filter((b) => daysLeft(b.expiresOn, day) === 1);
  const expired = stock.filter((b) => freshness(b.expiresOn, day) === "expired");
  const suggestions = suggestBundles(stock, day);

  const atEnd = totals.wasted.quantity + totals.rescued.quantity;
  const rate = atEnd ? `, rescue rate ${Math.round((totals.rescued.quantity / atEnd) * 100)}%` : "";

  const dateLabel = new Date(day + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
  const parts = [
    `${shop.name}: ShelfLife summary, ${dateLabel}`,
    section("⚠️", "Expires today", expiringToday),
    section("⏳", "Expires tomorrow", tomorrow),
    section("🗑️", "Already expired, log as wasted", expired),
    !expiringToday.length && !tomorrow.length && !expired.length ? "✅ Nothing expires today or tomorrow." : null,
    live.length ? `🛍️ ${live.length} bundle${live.length > 1 ? "s" : ""} on sale: ${live.map((b) => b.title).join("; ")}` : null,
    suggestions.length ? `💡 ${suggestions.length} rescue bundle${suggestions.length > 1 ? "s" : ""} ready to publish: ${appUrl}/bundles` : null,
    `📈 Last 7 days: ${rupees(rescued)} rescued with bundles, ${rupees(totals.wasted.cost)} wasted${rate}.`,
  ];
  return {
    text: parts.filter(Boolean).join("\n\n"),
    counts: { expiringToday: expiringToday.length, tomorrow: tomorrow.length, expired: expired.length, suggestions: suggestions.length },
  };
}
