import { describe, expect, it } from "vitest";
import { UPI_ID_PATTERN, upiNote, upiPayUrl } from "../upi";

describe("UPI", () => {
  it.each(["cafemogra@okhdfcbank", "9876543210@ybl", "cafe.blanc-1@paytm"])("accepts %s", (id) => {
    expect(UPI_ID_PATTERN.test(id)).toBe(true);
  });

  it.each(["cafemogra", "@ybl", "cafe@", "cafe mogra@ybl", "a@b@c", "cafe@1bank"])("rejects %s", (id) => {
    expect(UPI_ID_PATTERN.test(id)).toBe(false);
  });

  it("builds a standard upi://pay link with amount, currency and the pickup code as note", () => {
    const url = upiPayUrl({ upiId: "cafe@ybl", payeeName: "Café Blanc", amount: 35, note: upiNote("4821") });
    expect(url.startsWith("upi://pay?")).toBe(true);
    const q = new URLSearchParams(url.slice("upi://pay?".length));
    expect(q.get("pa")).toBe("cafe@ybl");
    expect(q.get("pn")).toBe("Café Blanc");
    expect(q.get("am")).toBe("35.00");
    expect(q.get("cu")).toBe("INR");
    expect(q.get("tn")).toBe("ShelfLife 4821");
    expect(url).not.toContain("+");
  });
});
