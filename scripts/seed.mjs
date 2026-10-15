// Fills ShelfLife with a sample café's week: stock across categories with expiry dates
// relative to today, some sales and waste already logged, and one bundle on sale.
// Goes through the running app's API, so it exercises the same validation as the UI.
//
// usage: npm run dev   (in another terminal), then
//        npm run seed [-- --url http://localhost:3000] [-- --force]
// Refuses to run if there is already stock, unless --force is given.

const i = process.argv.indexOf("--url");
const BASE = i > -1 ? process.argv[i + 1] : "http://localhost:3000";
const FORCE = process.argv.includes("--force");

const day = (n) => {
  const d = new Date(Date.now() + n * 86400000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

// [name, category, unit, quantity, unit cost ₹, unit price ₹, expires in N days]
const STOCK = [
  ["Croissant", "bakery", "pcs", 12, 25, 60, 0],
  ["Banana bread slice", "bakery", "pcs", 8, 20, 70, 1],
  ["Sourdough loaf", "bakery", "pcs", 4, 90, 220, 3],
  ["Cold coffee bottle", "beverages", "pcs", 10, 40, 120, 1],
  ["Fresh orange juice", "beverages", "L", 3, 80, 200, 0],
  ["Paneer tikka wrap", "prepared", "pcs", 6, 45, 140, 0],
  ["Chicken sandwich", "prepared", "pcs", 5, 55, 160, 1],
  ["Greek yoghurt cup", "dairy", "pcs", 10, 30, 80, 2],
  ["Milk (full cream)", "dairy", "L", 8, 64, 72, 5],
  ["Spinach", "produce", "kg", 1.5, 60, 120, 2],
  ["Avocado", "produce", "pcs", 6, 70, 150, 4],
  ["Granola pack", "packaged", "pack", 10, 120, 250, 60],
];

// Units already gone, so the stock list and dashboard start with some history.
const HISTORY = [
  ["Croissant", "sold", 5],
  ["Paneer tikka wrap", "sold", 2],
  ["Milk (full cream)", "sold", 3],
  ["Fresh orange juice", "wasted", 1],
  ["Spinach", "wasted", 0.5],
];

async function api(path, init = {}) {
  const res = await fetch(BASE + path, { ...init, headers: { "Content-Type": "application/json" } });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path}: ${body.error || res.status}`);
  return body;
}

async function main() {
  let existing;
  try {
    existing = await api("/api/stock");
  } catch {
    console.error(`Can't reach ${BASE}. Start the app with "npm run dev" first.`);
    process.exit(1);
  }
  if (existing.length && !FORCE) {
    console.error(`There is already stock (${existing.length} batches). Re-run with --force to add the sample data anyway.`);
    process.exit(1);
  }

  const ids = {};
  for (const [name, category, unit, quantity, unitCost, unitPrice, expiresIn] of STOCK) {
    const { id } = await api("/api/stock", {
      method: "POST",
      body: JSON.stringify({ name, category, unit, quantity, unitCost, unitPrice, expiresOn: day(expiresIn) }),
    });
    ids[name] = id;
  }
  console.log(`Added ${STOCK.length} batches.`);

  for (const [name, outcome, quantity] of HISTORY) {
    await api(`/api/stock/${ids[name]}/outcome`, { method: "POST", body: JSON.stringify({ outcome, quantity }) });
  }
  console.log(`Logged ${HISTORY.length} sales and waste entries.`);

  // Publish the top suggestion and sell two, so the deals page and dashboard aren't empty.
  const [top] = await api("/api/bundles/suggestions");
  if (top) {
    const { id } = await api("/api/bundles", {
      method: "POST",
      body: JSON.stringify({ title: top.title, description: top.description, items: top.items, price: top.price }),
    });
    await api(`/api/bundles/${id}/sell`, { method: "POST" });
    await api(`/api/bundles/${id}/sell`, { method: "POST" });
    console.log(`Published "${top.title}" at ₹${top.price} and sold 2.`);
  }

  console.log(`\nDone. Open ${BASE} (dashboard), ${BASE}/bundles and ${BASE}/deals`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
