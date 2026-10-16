import { describe, expect, it } from "vitest";
import { normalizePhone, orderMessage, planItems, whatsappUrl } from "../orders";
import { history } from "./helpers";

describe("normalizePhone", () => {
  it.each([
    ["98765 43210", "919876543210"],
    ["098765-43210", "919876543210"],
    ["+91 98765 43210", "919876543210"],
    ["0091 9876543210", "919876543210"],
    ["+44 7700 900123", "447700900123"],
  ])("%s → %s", (raw, want) => {
    expect(normalizePhone(raw)).toBe(want);
  });

  it.each(["12345", "abcdefghij", "", "+0 123 456 7890"])("rejects %s", (raw) => {
    expect(normalizePhone(raw)).toBeNull();
  });
});

describe("planItems", () => {
  const DAY = "2026-10-20";
  const croissants = [8, 7, 9, 8, 6].map((sold, i) =>
    history({ id: `c${i}`, name: "Croissant", quantity: 12, sold, wasted: 12 - sold, expiresOn: `2026-10-1${i}`, addedOn: `2026-10-1${i}` }),
  );
  const milk = [4, 4, 5].map((q, i) => history({ id: `m${i}`, name: "Milk", unit: "L", category: "dairy", quantity: q, sold: q, expiresOn: `2026-10-1${i}`, addedOn: `2026-10-1${i}` }));

  it("uses the ordering tip when there is one", () => {
    const c = planItems(croissants, DAY).find((i) => i.key === "croissant")!;
    expect(c).toMatchObject({ avgOrder: 12, suggested: 8, fromTip: true });
  });

  it("otherwise suggests the usual order, rounded to the unit", () => {
    const m = planItems(milk, DAY).find((i) => i.key === "milk")!;
    expect(m).toMatchObject({ avgOrder: 4.3, suggested: 4.5, fromTip: false, unit: "L" });
  });

  it("merges batches of the same item regardless of capitals and spaces", () => {
    const items = planItems([history({ id: "a", name: "Brownie" }), history({ id: "b", name: " brownie " })], DAY);
    expect(items).toHaveLength(1);
  });
});

describe("order message", () => {
  it("lists every line and opens WhatsApp to the supplier", () => {
    const text = orderMessage({
      supplierName: "Rahul",
      shopName: "Café Blanc",
      forDay: "Sat, 18 Oct",
      lines: [
        { name: "Croissant", quantity: 9, unit: "pcs" },
        { name: "Milk", quantity: 4.5, unit: "L" },
      ],
    });
    expect(text).toBe("Hi Rahul, this is Café Blanc. Please send for Sat, 18 Oct:\n\n• 9 pcs Croissant\n• 4.5 L Milk\n\nThank you!");
    expect(whatsappUrl("919876543210", text)).toMatch(/^https:\/\/wa\.me\/919876543210\?text=Hi%20Rahul/);
  });
});
