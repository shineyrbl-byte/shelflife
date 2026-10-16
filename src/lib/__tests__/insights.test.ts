import { describe, expect, it } from "vitest";
import { itemInsights, orderTips, wasteByWeekday } from "../insights";
import { history } from "./helpers";

const DAY = "2026-10-20";

// Five finished croissant batches of 12: about 8 sold at full price each time.
const croissants = [8, 7, 9, 8, 6].map((sold, i) =>
  history({ id: `c${i}`, name: "Croissant", quantity: 12, sold, wasted: 12 - sold, expiresOn: `2026-10-1${i}`, addedOn: `2026-10-1${i}` }),
);

describe("itemInsights", () => {
  it("adds up each item across its batches", () => {
    const [c] = itemInsights(croissants, DAY);
    expect(c.batches).toBe(5);
    expect(c.ordered).toBe(60);
    expect(c.sold).toBe(38);
    expect(c.wasted).toBe(22);
    expect(c.wasteCost).toBe(22 * 20);
  });

  it("counts stock left in an expired batch as wasted, even if nobody logged it", () => {
    const [x] = itemInsights([history({ id: "x", quantity: 10, sold: 6, remaining: 4, expiresOn: "2026-10-19" })], DAY);
    expect(x.wasted).toBe(4);
  });

  it("leaves out batches that are still on the shelf", () => {
    expect(itemInsights([history({ id: "y", remaining: 5, expiresOn: "2026-10-25" })], DAY)).toEqual([]);
  });
});

describe("orderTips", () => {
  it("suggests ordering what sold at full price on 80% of batches", () => {
    const [tip] = orderTips(croissants, DAY);
    expect(tip.name).toBe("Croissant");
    expect(tip.avgOrder).toBe(12);
    // Sold counts 6,7,8,8,9 → 80th percentile 8 (well below 12).
    expect(tip.suggested).toBe(8);
    expect(tip.monthlySaving).toBeGreaterThan(0);
  });

  it("needs at least 3 batches", () => {
    expect(orderTips(croissants.slice(0, 2), DAY)).toEqual([]);
  });

  it("stays quiet when almost everything sells", () => {
    const good = [11, 12, 12].map((sold, i) => history({ id: `g${i}`, name: "Bread", quantity: 12, sold, wasted: 12 - sold, expiresOn: `2026-10-1${i}` }));
    expect(orderTips(good, DAY)).toEqual([]);
  });
});

describe("wasteByWeekday", () => {
  it("puts waste on the right weekday, Monday first", () => {
    // 2026-10-19 is a Monday (local time, midday so time zones don't move it).
    const out = wasteByWeekday([
      { at: new Date(2026, 9, 19, 12).toISOString(), cost: 100 },
      { at: new Date(2026, 9, 25, 12).toISOString(), cost: 40 },
    ]);
    expect(out[0]).toEqual({ day: "Mon", cost: 100 });
    expect(out[6]).toEqual({ day: "Sun", cost: 40 });
  });
});
