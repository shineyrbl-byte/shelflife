import { describe, expect, it } from "vitest";
import { bundlesAvailable, notYetLive, suggestBundles } from "../bundles";
import { batch } from "./helpers";

const TODAY = "2026-10-16";

describe("suggestBundles", () => {
  it("pairs near-expiry items that go together and discounts by urgency", () => {
    const [s] = suggestBundles(
      [
        batch({ id: "croissant", category: "bakery", unitCost: 25, unitPrice: 60, expiresOn: TODAY }),
        batch({ id: "coffee", category: "beverages", unitCost: 40, unitPrice: 120, expiresOn: "2026-10-17" }),
      ],
      TODAY,
    );
    expect(s.title).toMatch(/^Breakfast rescue: /);
    expect(s.items.map((i) => i.batchId).sort()).toEqual(["coffee", "croissant"]);
    expect(s.originalPrice).toBe(180);
    // Expires today → 50% off.
    expect(s.price).toBe(90);
    expect(s.expiresOn).toBe(TODAY);
  });

  it("never prices a bundle below what the stock cost", () => {
    // Cost 50, price 60: 50% off would be 30, below cost.
    const [s] = suggestBundles([batch({ id: "cake", unitCost: 50, unitPrice: 60, expiresOn: TODAY })], TODAY);
    expect(s.price).toBeGreaterThanOrEqual(50);
    expect(s.price).toBeLessThan(60);
  });

  it("skips items with no room for a discount", () => {
    expect(suggestBundles([batch({ id: "water", unitCost: 20, unitPrice: 20, expiresOn: TODAY })], TODAY)).toEqual([]);
  });

  it("ignores expired and fresh stock (only today and the next 2 days)", () => {
    const out = suggestBundles(
      [batch({ id: "old", expiresOn: "2026-10-15" }), batch({ id: "fresh", expiresOn: "2026-10-25" }), batch({ id: "soon", expiresOn: "2026-10-18" })],
      TODAY,
    );
    expect(out.flatMap((s) => s.items.map((i) => i.batchId))).toEqual(["soon"]);
  });

  it("uses each at-risk batch in only one suggestion", () => {
    const out = suggestBundles(
      [
        batch({ id: "a", category: "bakery", expiresOn: TODAY }),
        batch({ id: "b", category: "beverages", expiresOn: TODAY }),
        batch({ id: "c", category: "bakery", expiresOn: TODAY }),
      ],
      TODAY,
    );
    const ids = out.flatMap((s) => s.items.map((i) => i.batchId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("knows how many bundles the stock can make", () => {
    const [s] = suggestBundles([batch({ id: "milk", category: "dairy", unit: "L", remaining: 2.2, expiresOn: TODAY })], TODAY);
    // 0.5 L portions from 2.2 L.
    expect(s.available).toBe(4);
  });
});

describe("bundlesAvailable", () => {
  it("is limited by the scarcest item", () => {
    expect(bundlesAvailable([{ quantity: 1, remaining: 5 }, { quantity: 0.5, remaining: 1 }])).toBe(2);
  });

  it("handles floating-point leftovers", () => {
    expect(bundlesAvailable([{ quantity: 0.1, remaining: 0.3 }])).toBe(3);
  });
});

describe("notYetLive", () => {
  it("drops suggestions with exactly the same items as a live bundle", () => {
    const suggestions = suggestBundles([batch({ id: "x", expiresOn: TODAY }), batch({ id: "y", category: "dairy", expiresOn: TODAY })], TODAY);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(notYetLive(suggestions, [{ items: suggestions[0].items }])).not.toContainEqual(suggestions[0]);
  });
});
