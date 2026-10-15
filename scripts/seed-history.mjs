// Adds 4 weeks of past batches with realistic sales and waste, so the Insights page has
// patterns to find (e.g. croissants over-baked, worst waste on Mondays).
// Writes to the database directly, because the API only creates stock dated today.
//
// usage: npm run seed:history   (run the app once first, so the tables exist)

import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "data", "shelflife.db");
if (!existsSync(file)) {
  console.error('No database yet. Start the app once with "npm run dev" (or run "npm run seed"), then try again.');
  process.exit(1);
}
const db = new DatabaseSync(file);
if (db.prepare("SELECT COUNT(*) AS n FROM batches WHERE added_on < date('now', '-1 day')").get().n > 0 && !process.argv.includes("--force")) {
  console.error("There is already past stock in the database. Re-run with --force to add more history anyway.");
  process.exit(1);
}

// Deterministic pseudo-random numbers, so every run produces the same story.
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const noise = (spread) => Math.round((rand() * 2 - 1) * spread);

const DAYS = 28;
// every: bake/delivery interval in days; life: days until expiry; demand(weekday 0=Sun) = units that sell at full price.
// Mondays are slow for croissants, and Sunday's unsold wraps are binned on Monday, so Monday is the worst waste day.
const ITEMS = [
  { name: "Croissant", category: "bakery", unit: "pcs", qty: 12, cost: 25, price: 60, every: 1, life: 0, demand: (wd) => (wd === 1 ? 4 : wd === 0 || wd === 6 ? 10 : 8) + noise(1) },
  { name: "Paneer tikka wrap", category: "prepared", unit: "pcs", qty: 8, cost: 45, price: 140, every: 1, life: 1, demand: (wd) => (wd === 0 ? 3 : wd === 6 ? 7 : 6) + noise(1) },
  { name: "Cold coffee bottle", category: "beverages", unit: "pcs", qty: 10, cost: 40, price: 120, every: 3, life: 3, demand: () => 9 + noise(1) },
  { name: "Sourdough loaf", category: "bakery", unit: "pcs", qty: 4, cost: 90, price: 220, every: 2, life: 2, demand: () => 4 - (rand() < 0.3 ? 1 : 0) },
  { name: "Greek yoghurt cup", category: "dairy", unit: "pcs", qty: 10, cost: 30, price: 80, every: 4, life: 5, demand: () => 6 + noise(2) },
];

const localDate = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const at = (daysAgo, hour) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const insertBatch = db.prepare(
  "INSERT INTO batches (id, name, category, unit, quantity, unit_cost, unit_price, expires_on, added_on) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
);
const insertEvent = db.prepare("INSERT INTO events (batch_id, outcome, quantity, bundle_id, at) VALUES (?, ?, ?, NULL, ?)");

let batches = 0;
db.exec("BEGIN");
for (const item of ITEMS) {
  // Stop early enough that every batch has expired, so its outcome is final.
  for (let ago = DAYS; ago > item.life + 1; ago -= item.every) {
    const added = at(ago, 7);
    const expires = at(ago - item.life, 20);
    const id = randomUUID().slice(0, 8);
    insertBatch.run(id, item.name, item.category, item.unit, item.qty, item.cost, item.price, localDate(expires), localDate(added));
    batches++;

    const sold = Math.max(0, Math.min(item.qty, item.demand(added.getDay())));
    if (sold) insertEvent.run(id, "sold", sold, at(ago, 13).toISOString());
    const left = item.qty - sold;
    // About half of the leftovers get rescued in bundles near expiry; the rest are binned.
    const rescued = Math.floor(left / 2);
    if (rescued) insertEvent.run(id, "rescued", rescued, at(ago - item.life, 17).toISOString());
    if (left - rescued) insertEvent.run(id, "wasted", left - rescued, expires.toISOString());
  }
}
db.exec("COMMIT");
console.log(`Added ${batches} past batches over ${DAYS} days. Open /insights to see the patterns.`);
