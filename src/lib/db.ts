import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { today, type Batch, type BatchInput, type Bundle, type BundleItem, type Outcome } from "./schema";

// SQLite keeps the app zero-config. Every query lives in this file.
const dir = path.join(process.cwd(), "data");
mkdirSync(dir, { recursive: true });

// Reuse one connection across Next.js hot reloads.
const globalForDb = globalThis as unknown as { slDb?: DatabaseSync };
const db = globalForDb.slDb ?? new DatabaseSync(path.join(dir, "shelflife.db"));
globalForDb.slDb = db;

db.exec(`
  CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_cost REAL NOT NULL,
    unit_price REAL NOT NULL,
    expires_on TEXT NOT NULL,
    added_on TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS batches_expiry ON batches(expires_on);
  -- Every unit that leaves a batch is logged here, so "remaining" and the waste report are derived, never stored.
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT NOT NULL REFERENCES batches(id),
    outcome TEXT NOT NULL,
    quantity REAL NOT NULL,
    bundle_id TEXT,
    at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS events_batch ON events(batch_id);
  CREATE TABLE IF NOT EXISTS bundles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    items TEXT NOT NULL,
    original_price REAL NOT NULL,
    price REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    expires_on TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

type Row = Record<string, unknown>;

const newId = () => randomUUID().slice(0, 8);

// ---- Batches ----

const BATCH_SELECT = `
  SELECT b.*, b.quantity - COALESCE((SELECT SUM(e.quantity) FROM events e WHERE e.batch_id = b.id), 0) AS remaining
  FROM batches b`;

function toBatch(r: Row): Batch {
  return {
    id: r.id as string,
    name: r.name as string,
    category: r.category as Batch["category"],
    unit: r.unit as Batch["unit"],
    quantity: r.quantity as number,
    unitCost: r.unit_cost as number,
    unitPrice: r.unit_price as number,
    expiresOn: r.expires_on as string,
    addedOn: r.added_on as string,
    remaining: r.remaining as number,
  };
}

export function insertBatch(input: BatchInput, addedOn = today()): string {
  const id = newId();
  db.prepare(
    `INSERT INTO batches (id, name, category, unit, quantity, unit_cost, unit_price, expires_on, added_on)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.name, input.category, input.unit, input.quantity, input.unitCost, input.unitPrice, input.expiresOn, addedOn);
  return id;
}

export function getBatch(id: string): Batch | null {
  const r = db.prepare(`${BATCH_SELECT} WHERE b.id = ?`).get(id) as Row | undefined;
  return r ? toBatch(r) : null;
}

/** Batches with stock left, soonest expiry first. */
export function listStock(): Batch[] {
  return (db.prepare(`${BATCH_SELECT} WHERE remaining > 0 ORDER BY b.expires_on, b.name`).all() as Row[]).map(toBatch);
}

export function deleteBatch(id: string) {
  db.prepare("DELETE FROM events WHERE batch_id = ?").run(id);
  db.prepare("DELETE FROM batches WHERE id = ?").run(id);
}

// ---- Events ----

export function logOutcome(batchId: string, outcome: Outcome, quantity: number, bundleId: string | null = null) {
  db.prepare("INSERT INTO events (batch_id, outcome, quantity, bundle_id, at) VALUES (?, ?, ?, ?, ?)").run(
    batchId,
    outcome,
    quantity,
    bundleId,
    new Date().toISOString(),
  );
}

export type OutcomeTotals = Record<Outcome, { quantity: number; cost: number; revenue: number }>;

/** Totals per outcome since a date (YYYY-MM-DD), valued at the batch's cost and normal price. */
export function outcomeTotals(since: string): OutcomeTotals {
  const rows = db
    .prepare(
      `SELECT e.outcome, SUM(e.quantity) AS qty, SUM(e.quantity * b.unit_cost) AS cost, SUM(e.quantity * b.unit_price) AS revenue
       FROM events e JOIN batches b ON b.id = e.batch_id
       WHERE e.at >= ? GROUP BY e.outcome`,
    )
    .all(since) as Row[];
  const totals: OutcomeTotals = {
    sold: { quantity: 0, cost: 0, revenue: 0 },
    wasted: { quantity: 0, cost: 0, revenue: 0 },
    rescued: { quantity: 0, cost: 0, revenue: 0 },
  };
  for (const r of rows) {
    totals[r.outcome as Outcome] = { quantity: r.qty as number, cost: r.cost as number, revenue: r.revenue as number };
  }
  return totals;
}

// ---- Bundles ----

function toBundle(r: Row): Bundle {
  return {
    id: r.id as string,
    title: r.title as string,
    description: r.description as string,
    items: JSON.parse(r.items as string),
    originalPrice: r.original_price as number,
    price: r.price as number,
    status: r.status as Bundle["status"],
    expiresOn: r.expires_on as string,
    createdAt: r.created_at as string,
  };
}

export function insertBundle(b: Omit<Bundle, "id" | "status" | "createdAt">): string {
  const id = newId();
  db.prepare(
    `INSERT INTO bundles (id, title, description, items, original_price, price, expires_on, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, b.title, b.description, JSON.stringify(b.items satisfies BundleItem[]), b.originalPrice, b.price, b.expiresOn, new Date().toISOString());
  return id;
}

export function getBundle(id: string): Bundle | null {
  const r = db.prepare("SELECT * FROM bundles WHERE id = ?").get(id) as Row | undefined;
  return r ? toBundle(r) : null;
}

/** Active bundles that haven't expired, soonest expiry first. */
export function listActiveBundles(): Bundle[] {
  return (
    db.prepare("SELECT * FROM bundles WHERE status = 'active' AND expires_on >= ? ORDER BY expires_on").all(today()) as Row[]
  ).map(toBundle);
}

export function setBundleStatus(id: string, status: Bundle["status"]) {
  db.prepare("UPDATE bundles SET status = ? WHERE id = ?").run(status, id);
}

/** Runs fn in a transaction, so multi-step writes (e.g. selling a bundle) are all-or-nothing. */
export function transaction<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
