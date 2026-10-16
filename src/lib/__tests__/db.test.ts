import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// A throwaway database for this file. db.ts reads TURSO_DATABASE_URL when it's first imported,
// and a file: URL works with libSQL just like a Turso address.
const dir = mkdtempSync(path.join(tmpdir(), "shelflife-test-"));
process.env.TURSO_DATABASE_URL = `file:${path.join(dir, "test.db")}`;
delete process.env.VERCEL;

type Db = typeof import("../db");
type Avail = typeof import("../availability");
let db: Db;
let availabilityOf: Avail["availabilityOf"];

const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const item = (name: string, quantity = 5, expiresIn = 0) =>
  ({ name, category: "bakery", unit: "pcs", quantity, unitCost: 20, unitPrice: 60, expiresOn: day(expiresIn) }) as const;

let shopA: Awaited<ReturnType<Db["createShopWithUser"]>>;
let shopB: Awaited<ReturnType<Db["createShopWithUser"]>>;

beforeAll(async () => {
  db = await import("../db");
  ({ availabilityOf } = await import("../availability"));
  shopA = await db.createShopWithUser("Café Alpha", "a@test.dev", "hash");
  shopB = await db.createShopWithUser("Café Alpha", "b@test.dev", "hash");
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("shops", () => {
  it("gives each shop a unique link name", () => {
    expect(shopA.shop.slug).toBe("cafe-alpha");
    expect(shopB.shop.slug).toBe("cafe-alpha-2");
  });

  it("makes the first user the owner", () => {
    expect(shopA.user.role).toBe("owner");
  });
});

describe("shop isolation", () => {
  it("never shows or changes one shop's stock from another shop", async () => {
    const id = await db.insertBatch(shopA.shop.id, item("Croissant"));
    expect(await db.getBatch(shopA.shop.id, id)).not.toBeNull();
    expect(await db.getBatch(shopB.shop.id, id)).toBeNull();
    expect((await db.getBatches(shopB.shop.id, [id])).size).toBe(0);
    expect((await db.listStock(shopB.shop.id)).map((b) => b.id)).not.toContain(id);

    await db.updateBatch(shopB.shop.id, id, { ...item("hacked") });
    await db.deleteBatch(shopB.shop.id, id);
    expect((await db.getBatch(shopA.shop.id, id))?.name).toBe("Croissant");
  });

  it("keeps bundles and reports separate too", async () => {
    const id = await db.insertBatch(shopA.shop.id, item("Muffin"));
    await db.logOutcome(id, "wasted", 2);
    expect((await db.outcomeTotals(shopA.shop.id, "2000-01-01")).wasted.quantity).toBeGreaterThanOrEqual(2);
    expect((await db.outcomeTotals(shopB.shop.id, "2000-01-01")).wasted.quantity).toBe(0);
  });
});

describe("selling bundles", () => {
  it("can't oversell, even with many sales at the same moment", async () => {
    const id = await db.insertBatch(shopA.shop.id, item("Brownie", 2));
    const bundleId = await db.insertBundle(shopA.shop.id, {
      title: "Brownie deal",
      description: "",
      items: [{ batchId: id, name: "Brownie", quantity: 1, unit: "pcs" }],
      originalPrice: 60,
      price: 30,
      expiresOn: day(0),
    });
    const bundle = (await db.getBundle(shopA.shop.id, bundleId))!;
    // The same check-then-record the "Sold 1" route does, six times at once.
    const sell = () =>
      db.transaction(async (tx) => {
        if ((await availabilityOf(shopA.shop.id, [bundle], tx)).get(bundle.id)!.available < 1) return false;
        await db.recordBundleSale(bundle, tx);
        return true;
      });
    const results = await Promise.all(Array.from({ length: 6 }, sell));
    expect(results.filter(Boolean)).toHaveLength(2);
    expect((await db.getBatch(shopA.shop.id, id))!.remaining).toBe(0);
  });
});

describe("reservations", () => {
  it("holds stock for the customer until the hold expires", async () => {
    const id = await db.insertBatch(shopA.shop.id, item("Wrap", 2));
    const bundleId = await db.insertBundle(shopA.shop.id, {
      title: "Wrap deal",
      description: "",
      items: [{ batchId: id, name: "Wrap", quantity: 1, unit: "pcs" }],
      originalPrice: 60,
      price: 30,
      expiresOn: day(0),
    });
    const bundle = (await db.getBundle(shopA.shop.id, bundleId))!;
    const avail = async (except = "") => (await availabilityOf(shopA.shop.id, [bundle], undefined, except)).get(bundleId)!;

    const held = await db.insertReservation(shopA.shop.id, {
      bundleId,
      customerName: "Asha",
      code: "1234",
      clientHash: "c1",
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
    expect(await avail()).toEqual({ fromStock: 2, held: 1, available: 1 });
    // Collecting your own reservation doesn't count your own hold against you.
    expect((await avail(held)).available).toBe(2);

    await db.insertReservation(shopA.shop.id, {
      bundleId,
      customerName: "Late",
      code: "5678",
      clientHash: "c2",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect((await avail()).held).toBe(1);
    expect(await db.countClientHolds(shopA.shop.id, "c1")).toBe(1);
    expect(await db.countClientHolds(shopA.shop.id, "c2")).toBe(0);
    expect(await db.getReservation(shopB.shop.id, held)).toBeNull();
  });
});

describe("accounts", () => {
  it("logs a user out everywhere when their password changes", async () => {
    await db.insertSession("s1", shopA.user.id, new Date(Date.now() + 86400000).toISOString());
    expect(await db.findSession("s1")).not.toBeNull();
    await db.setPassword(shopA.user.id, "new-hash");
    expect(await db.findSession("s1")).toBeNull();
  });

  it("ignores expired sessions", async () => {
    await db.insertSession("old", shopA.user.id, new Date(Date.now() - 1000).toISOString());
    expect(await db.findSession("old")).toBeNull();
  });

  it("uses each one-time link once, and never after it expires", async () => {
    await db.insertToken({ tokenHash: "t1", kind: "invite", shopId: shopA.shop.id, expiresAt: new Date(Date.now() + 60000).toISOString() });
    await db.insertToken({ tokenHash: "t2", kind: "invite", shopId: shopA.shop.id, expiresAt: new Date(Date.now() - 1).toISOString() });
    expect(await db.findValidToken("t1", "invite")).not.toBeNull();
    expect(await db.findValidToken("t1", "reset")).toBeNull();
    await db.markTokenUsed("t1");
    expect(await db.findValidToken("t1", "invite")).toBeNull();
    expect(await db.findValidToken("t2", "invite")).toBeNull();
  });

  it("removes a staff member and their sessions, but never the owner", async () => {
    const staff = await db.createStaffUser(shopA.shop.id, "Rahul", "rahul@test.dev", "hash");
    await db.insertSession("s-staff", staff.id, new Date(Date.now() + 86400000).toISOString());
    await db.deleteStaffUser(shopB.shop.id, staff.id); // wrong shop: nothing happens
    expect(await db.findSession("s-staff")).not.toBeNull();
    await db.deleteStaffUser(shopA.shop.id, staff.id);
    expect(await db.findSession("s-staff")).toBeNull();
    await db.deleteStaffUser(shopA.shop.id, shopA.user.id);
    expect(await db.getUser(shopA.shop.id, shopA.user.id)).not.toBeNull();
  });
});
