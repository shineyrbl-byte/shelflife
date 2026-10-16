import { createClient, type Client, type InValue, type Transaction } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { today, type Batch, type BatchInput, type Bundle, type BundleItem, type Category, type Outcome, type Unit } from "./schema";

// libSQL (SQLite-compatible). Locally it's a file in ./data with zero setup; in production,
// TURSO_DATABASE_URL + TURSO_AUTH_TOKEN point it at a hosted Turso database. Every query lives in this file.
// Every shop's data is separated by shop_id: functions that read or change stock take the shop's id.

function connect(): Client {
  if (process.env.TURSO_DATABASE_URL) {
    return createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  if (process.env.VERCEL) {
    // Vercel's file system is read-only and wiped on every deploy, so a local file can't work there.
    throw new Error("ShelfLife needs a hosted database on Vercel: set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in the project's Environment Variables.");
  }
  const dir = path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  return createClient({ url: `file:${path.join(dir, "shelflife.db")}` });
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS shops (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    ntfy_topic TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL REFERENCES shops(id),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  -- Only a hash of each session token is stored, so a leaked database can't be used to log in.
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    expires_at TEXT NOT NULL
  );
  -- What the shop knows about each barcode, so scanning a known item fills in the details.
  -- One-time links: staff invites and password resets. Only a hash of each token is stored.
  CREATE TABLE IF NOT EXISTS tokens (
    token_hash TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    shop_id TEXT NOT NULL REFERENCES shops(id),
    user_id TEXT REFERENCES users(id),
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT
  );
  CREATE TABLE IF NOT EXISTS products (
    shop_id TEXT NOT NULL REFERENCES shops(id),
    barcode TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    unit_cost REAL NOT NULL,
    unit_price REAL NOT NULL,
    shelf_life_days INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (shop_id, barcode)
  );
  CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    shop_id TEXT REFERENCES shops(id),
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
    shop_id TEXT REFERENCES shops(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    items TEXT NOT NULL,
    original_price REAL NOT NULL,
    price REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    expires_on TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  -- Customer pre-orders: a bundle held for pickup until expires_at. Only a first name is kept.
  CREATE TABLE IF NOT EXISTS reservations (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL REFERENCES shops(id),
    bundle_id TEXT NOT NULL REFERENCES bundles(id),
    customer_name TEXT NOT NULL,
    code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'held',
    client_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS reservations_shop ON reservations(shop_id, status, expires_at);
  CREATE TABLE IF NOT EXISTS bundle_sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bundle_id TEXT NOT NULL REFERENCES bundles(id),
    price REAL NOT NULL,
    at TEXT NOT NULL
  );
`;

/** Creates tables, and adds columns that older databases don't have yet. */
async function migrate(c: Client) {
  await c.executeMultiple(SCHEMA);
  const addColumn = async (table: string, column: string, definition: string) => {
    const cols = (await c.execute(`PRAGMA table_info(${table})`)).rows.map((r) => r.name);
    if (!cols.includes(column)) await c.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  };
  await addColumn("batches", "shop_id", "TEXT REFERENCES shops(id)");
  await addColumn("bundles", "shop_id", "TEXT REFERENCES shops(id)");
  // Everyone who signed up before staff logins existed is their shop's owner.
  await addColumn("users", "role", "TEXT NOT NULL DEFAULT 'owner'");
  await addColumn("users", "name", "TEXT NOT NULL DEFAULT ''");
  await c.executeMultiple(`
    CREATE INDEX IF NOT EXISTS batches_shop ON batches(shop_id, expires_on);
    CREATE INDEX IF NOT EXISTS bundles_shop ON bundles(shop_id, status);
  `);
}

// One client and one migration per server process (and across Next.js hot reloads).
const g = globalThis as unknown as { slClient?: Client; slReady?: Promise<void> };
const client = (g.slClient ??= connect());
const ready = (g.slReady ??= migrate(client));

/** Anything that can run a query: the shared client, or a transaction in progress. */
export type Db = Client | Transaction;

type Row = Record<string, unknown>;

async function all(sql: string, args: InValue[] = [], db: Db = client): Promise<Row[]> {
  await ready;
  return (await db.execute({ sql, args })).rows as unknown as Row[];
}
async function one(sql: string, args: InValue[] = [], db: Db = client): Promise<Row | undefined> {
  return (await all(sql, args, db))[0];
}
async function run(sql: string, args: InValue[] = [], db: Db = client) {
  await ready;
  return db.execute({ sql, args });
}

// Write transactions from this server run one at a time (e.g. two tills selling the same bundle),
// and retry briefly if another process holds the database lock.
let queue: Promise<unknown> = Promise.resolve();
const isBusy = (err: unknown) => /SQLITE_BUSY|database is locked/i.test(String((err as Error)?.message ?? err));

async function runTransaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    let tx: Transaction | null = null;
    try {
      tx = await client.transaction("write");
      const result = await fn(tx);
      await tx.commit();
      return result;
    } catch (err) {
      await tx?.rollback().catch(() => {});
      if (!isBusy(err) || attempt >= 4) throw err;
      await new Promise((r) => setTimeout(r, 50 * 2 ** attempt));
    } finally {
      tx?.close();
    }
  }
}

/** Runs fn in a write transaction, so multi-step writes (e.g. selling a bundle) are all-or-nothing. */
export async function transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  await ready;
  const result = queue.then(() => runTransaction(fn));
  queue = result.catch(() => {});
  return result;
}

const newId = () => randomUUID().slice(0, 8);

// ---- Shops, users, sessions ----

export type Shop = { id: string; name: string; slug: string; ntfyTopic: string | null };
export type Role = "owner" | "staff";
export type User = { id: string; shopId: string; email: string; name: string; role: Role };

const toUser = (r: Row, idCol = "id"): User => ({
  id: r[idCol] as string,
  shopId: r.shop_id as string,
  email: r.email as string,
  name: (r.name as string) ?? "",
  role: (r.role as Role) ?? "owner",
});

const toShop = (r: Row): Shop => ({ id: r.id as string, name: r.name as string, slug: r.slug as string, ntfyTopic: (r.ntfy_topic as string) || null });

/** "Café Mogra, Goa!" -> "cafe-mogra-goa" */
const slugify = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "shop";

/**
 * Creates a shop and its first user. Locally, the very first shop also takes over any stock
 * created before accounts existed, so earlier data isn't lost.
 */
export async function createShopWithUser(name: string, email: string, passwordHash: string): Promise<{ shop: Shop; user: User }> {
  return transaction(async (tx) => {
    const base = slugify(name);
    let slug = base;
    for (let n = 2; await one("SELECT 1 FROM shops WHERE slug = ?", [slug], tx); n++) slug = `${base}-${n}`;
    const shop: Shop = { id: newId(), name, slug, ntfyTopic: null };
    const user: User = { id: newId(), shopId: shop.id, email, name: "", role: "owner" };
    const now = new Date().toISOString();
    const isFirst = !(await one("SELECT 1 FROM shops LIMIT 1", [], tx));
    await run("INSERT INTO shops (id, name, slug, created_at) VALUES (?, ?, ?, ?)", [shop.id, name, slug, now], tx);
    await run("INSERT INTO users (id, shop_id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, 'owner', ?)", [user.id, shop.id, email, passwordHash, now], tx);
    if (isFirst) {
      await run("UPDATE batches SET shop_id = ? WHERE shop_id IS NULL", [shop.id], tx);
      await run("UPDATE bundles SET shop_id = ? WHERE shop_id IS NULL", [shop.id], tx);
    }
    return { shop, user };
  });
}

export async function findUserByEmail(email: string, db: Db = client): Promise<(User & { passwordHash: string }) | null> {
  const r = await one("SELECT * FROM users WHERE email = ?", [email], db);
  return r ? { ...toUser(r), passwordHash: r.password_hash as string } : null;
}

// ---- Team ----

/** Everyone who can log in to the shop, owner first. */
export async function listTeam(shopId: string): Promise<(User & { createdAt: string })[]> {
  const rows = await all("SELECT * FROM users WHERE shop_id = ? ORDER BY role = 'owner' DESC, created_at", [shopId]);
  return rows.map((r) => ({ ...toUser(r), createdAt: r.created_at as string }));
}

export async function getUser(shopId: string, id: string): Promise<User | null> {
  const r = await one("SELECT * FROM users WHERE shop_id = ? AND id = ?", [shopId, id]);
  return r ? toUser(r) : null;
}

export async function createStaffUser(shopId: string, name: string, email: string, passwordHash: string, db: Db = client): Promise<User> {
  const user: User = { id: newId(), shopId, email, name, role: "staff" };
  await run(
    "INSERT INTO users (id, shop_id, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, 'staff', ?)",
    [user.id, shopId, email, name, passwordHash, new Date().toISOString()],
    db,
  );
  return user;
}

/** Removes a staff login and logs it out everywhere. Owners can't be removed this way. */
export async function deleteStaffUser(shopId: string, userId: string) {
  await transaction(async (tx) => {
    const r = await one("SELECT 1 FROM users WHERE id = ? AND shop_id = ? AND role = 'staff'", [userId, shopId], tx);
    if (!r) return;
    await run("DELETE FROM sessions WHERE user_id = ?", [userId], tx);
    await run("DELETE FROM tokens WHERE user_id = ?", [userId], tx);
    await run("DELETE FROM users WHERE id = ?", [userId], tx);
  });
}

/** Sets a new password and logs the user out everywhere, so an old session can't keep going. */
export async function setPassword(userId: string, passwordHash: string, db: Db = client) {
  await run("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, userId], db);
  await run("DELETE FROM sessions WHERE user_id = ?", [userId], db);
}

// ---- One-time tokens (invites, password resets) ----

export type TokenKind = "invite" | "reset";
export type TokenRecord = { kind: TokenKind; shopId: string; userId: string | null; expiresAt: string };

export async function insertToken(t: { tokenHash: string; kind: TokenKind; shopId: string; userId?: string; expiresAt: string }) {
  await run(
    "INSERT INTO tokens (token_hash, kind, shop_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
    [t.tokenHash, t.kind, t.shopId, t.userId ?? null, new Date().toISOString(), t.expiresAt],
  );
}

/** A token that exists, hasn't been used and hasn't expired. */
export async function findValidToken(tokenHash: string, kind: TokenKind, db: Db = client): Promise<TokenRecord | null> {
  const r = await one("SELECT * FROM tokens WHERE token_hash = ? AND kind = ? AND used_at IS NULL AND expires_at > ?", [tokenHash, kind, new Date().toISOString()], db);
  return r ? { kind, shopId: r.shop_id as string, userId: (r.user_id as string) || null, expiresAt: r.expires_at as string } : null;
}

export async function markTokenUsed(tokenHash: string, db: Db = client) {
  await run("UPDATE tokens SET used_at = ? WHERE token_hash = ?", [new Date().toISOString(), tokenHash], db);
}

/** Invite links that are still open, newest first. The id is the token's hash, which can't be turned back into the link. */
export async function listOpenInvites(shopId: string): Promise<{ id: string; createdAt: string; expiresAt: string }[]> {
  const rows = await all(
    "SELECT token_hash, created_at, expires_at FROM tokens WHERE shop_id = ? AND kind = 'invite' AND used_at IS NULL AND expires_at > ? ORDER BY created_at DESC",
    [shopId, new Date().toISOString()],
  );
  return rows.map((r) => ({ id: r.token_hash as string, createdAt: r.created_at as string, expiresAt: r.expires_at as string }));
}

export async function revokeInvite(shopId: string, tokenHash: string) {
  await run("UPDATE tokens SET used_at = ? WHERE token_hash = ? AND shop_id = ? AND kind = 'invite'", [new Date().toISOString(), tokenHash, shopId]);
}

/** Recent reset links for a user, to stop someone flooding their inbox. */
export async function countRecentResets(userId: string, sinceIso: string): Promise<number> {
  return ((await one("SELECT COUNT(*) AS n FROM tokens WHERE kind = 'reset' AND user_id = ? AND created_at > ?", [userId, sinceIso]))?.n as number) ?? 0;
}

export async function getShop(id: string): Promise<Shop | null> {
  const r = await one("SELECT * FROM shops WHERE id = ?", [id]);
  return r ? toShop(r) : null;
}

export async function getShopBySlug(slug: string): Promise<Shop | null> {
  const r = await one("SELECT * FROM shops WHERE slug = ?", [slug]);
  return r ? toShop(r) : null;
}

export async function updateShop(id: string, patch: { name?: string; ntfyTopic?: string | null }) {
  if (patch.name !== undefined) await run("UPDATE shops SET name = ? WHERE id = ?", [patch.name, id]);
  if (patch.ntfyTopic !== undefined) await run("UPDATE shops SET ntfy_topic = ? WHERE id = ?", [patch.ntfyTopic, id]);
}

/** Shops that want the daily summary pushed to their phones. */
export async function listShopsWithNtfy(): Promise<Shop[]> {
  return (await all("SELECT * FROM shops WHERE ntfy_topic IS NOT NULL AND ntfy_topic != ''")).map(toShop);
}

export async function insertSession(tokenHash: string, userId: string, expiresAt: string) {
  await run("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)", [tokenHash, userId, expiresAt]);
}

/** The user and shop behind a session token hash, if it hasn't expired. */
export async function findSession(tokenHash: string): Promise<{ user: User; shop: Shop } | null> {
  const r = await one(
    `SELECT u.id AS user_id, u.email, u.name AS user_name, u.role, s.* FROM sessions x
     JOIN users u ON u.id = x.user_id JOIN shops s ON s.id = u.shop_id
     WHERE x.token_hash = ? AND x.expires_at > ?`,
    [tokenHash, new Date().toISOString()],
  );
  if (!r) return null;
  return {
    user: { id: r.user_id as string, shopId: r.id as string, email: r.email as string, name: (r.user_name as string) ?? "", role: (r.role as Role) ?? "owner" },
    shop: toShop(r),
  };
}

export async function deleteSession(tokenHash: string) {
  await run("DELETE FROM sessions WHERE token_hash = ? OR expires_at <= ?", [tokenHash, new Date().toISOString()]);
}

// ---- Products (barcodes) ----

export type Product = Pick<Batch, "name" | "category" | "unit" | "unitCost" | "unitPrice"> & { barcode: string; shelfLifeDays: number };

export async function getProduct(shopId: string, barcode: string): Promise<Product | null> {
  const r = await one("SELECT * FROM products WHERE shop_id = ? AND barcode = ?", [shopId, barcode]);
  if (!r) return null;
  return {
    barcode,
    name: r.name as string,
    category: r.category as Product["category"],
    unit: r.unit as Product["unit"],
    unitCost: r.unit_cost as number,
    unitPrice: r.unit_price as number,
    shelfLifeDays: r.shelf_life_days as number,
  };
}

/** Remembers (or updates) what a barcode is, from the latest stock added with it. */
export async function saveProduct(shopId: string, p: Product) {
  await run(
    `INSERT INTO products (shop_id, barcode, name, category, unit, unit_cost, unit_price, shelf_life_days, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (shop_id, barcode) DO UPDATE SET name = excluded.name, category = excluded.category, unit = excluded.unit,
       unit_cost = excluded.unit_cost, unit_price = excluded.unit_price, shelf_life_days = excluded.shelf_life_days, updated_at = excluded.updated_at`,
    [shopId, p.barcode, p.name, p.category, p.unit, p.unitCost, p.unitPrice, p.shelfLifeDays, new Date().toISOString()],
  );
}

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

export async function insertBatch(shopId: string, input: BatchInput, addedOn = today(), db: Db = client): Promise<string> {
  const id = newId();
  await run(
    `INSERT INTO batches (id, shop_id, name, category, unit, quantity, unit_cost, unit_price, expires_on, added_on)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, shopId, input.name, input.category, input.unit, input.quantity, input.unitCost, input.unitPrice, input.expiresOn, addedOn],
    db,
  );
  return id;
}

export async function updateBatch(shopId: string, id: string, input: BatchInput) {
  await run(
    `UPDATE batches SET name = ?, category = ?, unit = ?, quantity = ?, unit_cost = ?, unit_price = ?, expires_on = ? WHERE id = ? AND shop_id = ?`,
    [input.name, input.category, input.unit, input.quantity, input.unitCost, input.unitPrice, input.expiresOn, id, shopId],
  );
}

export async function getBatch(shopId: string, id: string, db: Db = client): Promise<Batch | null> {
  const r = await one(`${BATCH_SELECT} WHERE b.id = ? AND b.shop_id = ?`, [id, shopId], db);
  return r ? toBatch(r) : null;
}

/** A shop's batches by id (ids from other shops or missing ones are left out), in one query. */
export async function getBatches(shopId: string, ids: string[], db: Db = client): Promise<Map<string, Batch>> {
  if (!ids.length) return new Map();
  const rows = await all(`${BATCH_SELECT} WHERE b.shop_id = ? AND b.id IN (${ids.map(() => "?").join(",")})`, [shopId, ...ids], db);
  return new Map(rows.map((r) => [r.id as string, toBatch(r)]));
}

/** Batches with stock left, soonest expiry first. */
export async function listStock(shopId: string): Promise<Batch[]> {
  return (await all(`${BATCH_SELECT} WHERE b.shop_id = ? AND remaining > 0 ORDER BY b.expires_on, b.name`, [shopId])).map(toBatch);
}

export type BatchHistory = Batch & Record<Outcome, number>;

/** Batches added since a date (YYYY-MM-DD), with how much of each was sold, rescued and wasted. */
export async function listBatchesSince(shopId: string, since: string): Promise<BatchHistory[]> {
  const sum = (o: Outcome) => `COALESCE((SELECT SUM(e.quantity) FROM events e WHERE e.batch_id = b.id AND e.outcome = '${o}'), 0) AS ${o}`;
  const rows = await all(
    `SELECT *, ${sum("sold")}, ${sum("rescued")}, ${sum("wasted")}, ${sum("donated")} FROM (${BATCH_SELECT} WHERE b.shop_id = ?) b WHERE b.added_on >= ? ORDER BY b.added_on`,
    [shopId, since],
  );
  return rows.map((r) => ({ ...toBatch(r), sold: r.sold as number, rescued: r.rescued as number, wasted: r.wasted as number, donated: r.donated as number }));
}

/** Waste events since a date, with their value at cost, for the by-weekday breakdown. */
export async function listWasteSince(shopId: string, since: string): Promise<{ at: string; cost: number }[]> {
  const rows = await all(
    `SELECT e.at, e.quantity * b.unit_cost AS cost FROM events e JOIN batches b ON b.id = e.batch_id
     WHERE b.shop_id = ? AND e.outcome = 'wasted' AND e.at >= ?`,
    [shopId, since],
  );
  return rows.map((r) => ({ at: r.at as string, cost: r.cost as number }));
}

export async function deleteBatch(shopId: string, id: string) {
  await transaction(async (tx) => {
    const owned = await one("SELECT 1 FROM batches WHERE id = ? AND shop_id = ?", [id, shopId], tx);
    if (!owned) return;
    await run("DELETE FROM events WHERE batch_id = ?", [id], tx);
    await run("DELETE FROM batches WHERE id = ?", [id], tx);
  });
}

// ---- Events ----

/** Logs units leaving a batch. Callers must have checked the batch belongs to the shop. */
export async function logOutcome(batchId: string, outcome: Outcome, quantity: number, bundleId: string | null = null, db: Db = client) {
  await run(
    "INSERT INTO events (batch_id, outcome, quantity, bundle_id, at) VALUES (?, ?, ?, ?, ?)",
    [batchId, outcome, quantity, bundleId, new Date().toISOString()],
    db,
  );
}

export type OutcomeTotals = Record<Outcome, { quantity: number; cost: number; revenue: number }>;

/** Totals per outcome since a date (YYYY-MM-DD), valued at the batch's cost and normal price. */
export async function outcomeTotals(shopId: string, since: string): Promise<OutcomeTotals> {
  const rows = await all(
    `SELECT e.outcome, SUM(e.quantity) AS qty, SUM(e.quantity * b.unit_cost) AS cost, SUM(e.quantity * b.unit_price) AS revenue
     FROM events e JOIN batches b ON b.id = e.batch_id
     WHERE b.shop_id = ? AND e.at >= ? GROUP BY e.outcome`,
    [shopId, since],
  );
  const totals: OutcomeTotals = {
    sold: { quantity: 0, cost: 0, revenue: 0 },
    wasted: { quantity: 0, cost: 0, revenue: 0 },
    rescued: { quantity: 0, cost: 0, revenue: 0 },
    donated: { quantity: 0, cost: 0, revenue: 0 },
  };
  for (const r of rows) {
    totals[r.outcome as Outcome] = { quantity: r.qty as number, cost: r.cost as number, revenue: r.revenue as number };
  }
  return totals;
}

// ---- Bundles ----

const BUNDLE_SELECT = `SELECT *, (SELECT COUNT(*) FROM bundle_sales s WHERE s.bundle_id = bundles.id) AS sold_count FROM bundles`;

function toBundle(r: Row): Bundle {
  return {
    id: r.id as string,
    title: r.title as string,
    description: r.description as string,
    items: JSON.parse(r.items as string),
    originalPrice: r.original_price as number,
    price: r.price as number,
    status: r.status as Bundle["status"],
    soldCount: r.sold_count as number,
    expiresOn: r.expires_on as string,
    createdAt: r.created_at as string,
  };
}

export async function insertBundle(shopId: string, b: Omit<Bundle, "id" | "status" | "soldCount" | "createdAt">): Promise<string> {
  const id = newId();
  await run(
    `INSERT INTO bundles (id, shop_id, title, description, items, original_price, price, expires_on, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, shopId, b.title, b.description, JSON.stringify(b.items satisfies BundleItem[]), b.originalPrice, b.price, b.expiresOn, new Date().toISOString()],
  );
  return id;
}

export async function getBundle(shopId: string, id: string): Promise<Bundle | null> {
  const r = await one(`${BUNDLE_SELECT} WHERE id = ? AND shop_id = ?`, [id, shopId]);
  return r ? toBundle(r) : null;
}

/** Active bundles that haven't expired, soonest expiry first. */
export async function listActiveBundles(shopId: string): Promise<Bundle[]> {
  return (await all(`${BUNDLE_SELECT} WHERE shop_id = ? AND status = 'active' AND expires_on >= ? ORDER BY expires_on`, [shopId, today()])).map(toBundle);
}

/** Logs one bundle sale: each item's portion leaves its batch as "rescued". Bundles only hold their own shop's batches. */
export async function recordBundleSale(bundle: Bundle, db: Db = client) {
  for (const item of bundle.items) await logOutcome(item.batchId, "rescued", item.quantity, bundle.id, db);
  await run("INSERT INTO bundle_sales (bundle_id, price, at) VALUES (?, ?, ?)", [bundle.id, bundle.price, new Date().toISOString()], db);
}

/** Money taken from bundle sales since a date (YYYY-MM-DD), at the discounted price. */
export async function bundleRevenue(shopId: string, since: string): Promise<number> {
  const r = await one(
    "SELECT COALESCE(SUM(s.price), 0) AS total FROM bundle_sales s JOIN bundles b ON b.id = s.bundle_id WHERE b.shop_id = ? AND s.at >= ?",
    [shopId, since],
  );
  return (r?.total as number) ?? 0;
}

export async function setBundleStatus(shopId: string, id: string, status: Bundle["status"], db: Db = client) {
  await run("UPDATE bundles SET status = ? WHERE id = ? AND shop_id = ?", [status, id, shopId], db);
}

// ---- Reservations (customer pre-orders) ----

export type Reservation = {
  id: string;
  bundleId: string;
  bundleTitle: string;
  price: number;
  customerName: string;
  code: string;
  status: "held" | "collected" | "cancelled";
  createdAt: string;
  expiresAt: string;
};

const RESERVATION_SELECT = `SELECT r.*, b.title AS bundle_title, b.price FROM reservations r JOIN bundles b ON b.id = r.bundle_id`;

const toReservation = (r: Row): Reservation => ({
  id: r.id as string,
  bundleId: r.bundle_id as string,
  bundleTitle: r.bundle_title as string,
  price: r.price as number,
  customerName: r.customer_name as string,
  code: r.code as string,
  status: r.status as Reservation["status"],
  createdAt: r.created_at as string,
  expiresAt: r.expires_at as string,
});

/** Active holds per bundle (held and not yet expired), optionally leaving one reservation out. */
export async function holdsByBundle(shopId: string, db: Db = client, exceptId = ""): Promise<Map<string, number>> {
  const rows = await all(
    "SELECT bundle_id, COUNT(*) AS n FROM reservations WHERE shop_id = ? AND status = 'held' AND expires_at > ? AND id != ? GROUP BY bundle_id",
    [shopId, new Date().toISOString(), exceptId],
    db,
  );
  return new Map(rows.map((r) => [r.bundle_id as string, r.n as number]));
}

/** Active holds this customer (by hashed IP) already has at the shop. */
export async function countClientHolds(shopId: string, clientHash: string, db: Db = client): Promise<number> {
  const r = await one(
    "SELECT COUNT(*) AS n FROM reservations WHERE shop_id = ? AND client_hash = ? AND status = 'held' AND expires_at > ?",
    [shopId, clientHash, new Date().toISOString()],
    db,
  );
  return (r?.n as number) ?? 0;
}

/** Pickup codes in use right now, so a new one doesn't clash. */
export async function activeCodes(shopId: string, db: Db = client): Promise<Set<string>> {
  const rows = await all("SELECT code FROM reservations WHERE shop_id = ? AND status = 'held' AND expires_at > ?", [shopId, new Date().toISOString()], db);
  return new Set(rows.map((r) => r.code as string));
}

export async function insertReservation(
  shopId: string,
  r: { bundleId: string; customerName: string; code: string; clientHash: string; expiresAt: string },
  db: Db = client,
): Promise<string> {
  const id = randomUUID();
  await run(
    `INSERT INTO reservations (id, shop_id, bundle_id, customer_name, code, client_hash, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, shopId, r.bundleId, r.customerName, r.code, r.clientHash, new Date().toISOString(), r.expiresAt],
    db,
  );
  return id;
}

export async function getReservation(shopId: string, id: string, db: Db = client): Promise<Reservation | null> {
  const r = await one(`${RESERVATION_SELECT} WHERE r.shop_id = ? AND r.id = ?`, [shopId, id], db);
  return r ? toReservation(r) : null;
}

/** Held reservations from the last day (including ones that just expired), soonest pickup first. */
export async function listOpenReservations(shopId: string): Promise<Reservation[]> {
  const since = new Date(Date.now() - 86400000).toISOString();
  return (await all(`${RESERVATION_SELECT} WHERE r.shop_id = ? AND r.status = 'held' AND r.expires_at > ? ORDER BY r.expires_at`, [shopId, since])).map(
    toReservation,
  );
}

export async function setReservationStatus(shopId: string, id: string, status: Reservation["status"], db: Db = client) {
  await run("UPDATE reservations SET status = ? WHERE id = ? AND shop_id = ?", [status, id, shopId], db);
}

// ---- Impact ----

/**
 * Rescued (sold in bundles) and donated quantities grouped by unit and category, plus bundle revenue and sales, since a date.
 * shopId null = all shops together (for the public homepage counter).
 */
export async function rescueTotals(shopId: string | null, since = "0000") {
  const shopFilter = shopId ? "AND b.shop_id = ?" : "";
  const args = (extra: InValue[]) => (shopId ? [...extra, shopId] : extra);
  const [rows, money] = await Promise.all([
    all(
      `SELECT e.outcome, b.unit, b.category, SUM(e.quantity) AS qty FROM events e JOIN batches b ON b.id = e.batch_id
       WHERE e.outcome IN ('rescued', 'donated') AND e.at >= ? ${shopFilter} GROUP BY e.outcome, b.unit, b.category`,
      args([since]),
    ),
    one(
      `SELECT COALESCE(SUM(s.price), 0) AS total, COUNT(*) AS n FROM bundle_sales s JOIN bundles b ON b.id = s.bundle_id
       WHERE s.at >= ? ${shopFilter}`,
      args([since]),
    ),
  ]);
  return {
    rows: rows.map((r) => ({ outcome: r.outcome as "rescued" | "donated", unit: r.unit as Unit, category: r.category as Category, quantity: r.qty as number })),
    money: (money?.total as number) ?? 0,
    bundlesSold: (money?.n as number) ?? 0,
  };
}

export async function countShops(): Promise<number> {
  return ((await one("SELECT COUNT(*) AS n FROM shops"))?.n as number) ?? 0;
}

