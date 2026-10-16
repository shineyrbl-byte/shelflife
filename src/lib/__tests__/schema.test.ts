import { describe, expect, it } from "vitest";
import { BarcodeSchema, BatchInputSchema, daysLeft, expiryLabel, freshness, rupees } from "../schema";

describe("expiry helpers", () => {
  it("counts whole days, negative once expired", () => {
    expect(daysLeft("2026-10-18", "2026-10-16")).toBe(2);
    expect(daysLeft("2026-10-16", "2026-10-16")).toBe(0);
    expect(daysLeft("2026-10-14", "2026-10-16")).toBe(-2);
  });

  it("works across a month and year boundary", () => {
    expect(daysLeft("2027-01-01", "2026-12-31")).toBe(1);
  });

  it("groups by urgency: soon means within 2 days", () => {
    const from = "2026-10-16";
    expect(freshness("2026-10-15", from)).toBe("expired");
    expect(freshness("2026-10-16", from)).toBe("today");
    expect(freshness("2026-10-17", from)).toBe("soon");
    expect(freshness("2026-10-18", from)).toBe("soon");
    expect(freshness("2026-10-19", from)).toBe("fresh");
  });

  it("labels today and tomorrow in words", () => {
    expect(expiryLabel("2026-10-16", "2026-10-16")).toBe("today");
    expect(expiryLabel("2026-10-17", "2026-10-16")).toBe("tomorrow");
    expect(expiryLabel("2026-10-20", "2026-10-16")).toMatch(/20/);
  });
});

describe("rupees", () => {
  it("rounds and uses Indian digit grouping", () => {
    expect(rupees(1234567.4)).toBe("₹12,34,567");
    expect(rupees(59.6)).toBe("₹60");
  });
});

describe("input validation", () => {
  const ok = { name: "Croissant", category: "bakery", unit: "pcs", quantity: 12, unitCost: 25, unitPrice: 60, expiresOn: "2026-10-16" };

  it("accepts a normal batch", () => {
    expect(BatchInputSchema.safeParse(ok).success).toBe(true);
  });

  it.each([
    ["empty name", { name: "  " }],
    ["zero quantity", { quantity: 0 }],
    ["negative cost", { unitCost: -1 }],
    ["unknown category", { category: "toys" }],
    ["badly formatted date", { expiresOn: "16/10/2026" }],
  ])("rejects %s", (_, patch) => {
    expect(BatchInputSchema.safeParse({ ...ok, ...patch }).success).toBe(false);
  });

  it("accepts EAN barcodes and rejects junk", () => {
    expect(BarcodeSchema.safeParse("8901063093071").success).toBe(true);
    expect(BarcodeSchema.safeParse("<script>").success).toBe(false);
    expect(BarcodeSchema.safeParse("12").success).toBe(false);
  });
});
