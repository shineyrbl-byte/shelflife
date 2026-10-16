import { describe, expect, it } from "vitest";
import { toCsv } from "../csv";
import { impactOf, weightKg } from "../impact";

describe("impact", () => {
  it("uses real weight for kg and litres, and typical weights for pieces", () => {
    expect(weightKg("kg", "produce", 1.5)).toBe(1.5);
    expect(weightKg("L", "dairy", 2)).toBe(2);
    expect(weightKg("pcs", "bakery", 10)).toBeCloseTo(0.8);
  });

  it("adds donated food to the total and reports it separately", () => {
    const i = impactOf(
      [
        { outcome: "rescued", unit: "pcs", category: "prepared", quantity: 4 },
        { outcome: "donated", unit: "kg", category: "produce", quantity: 2 },
      ],
      480,
      4,
    );
    expect(i.kgRescued).toBe(3);
    expect(i.kgDonated).toBe(2);
    expect(i.co2Kg).toBe(8); // 3 kg × 2.5, rounded
    expect(i.moneyRecovered).toBe(480);
  });
});

describe("toCsv", () => {
  const body = (csv: string) => csv.replace(/^﻿/, "");

  it("starts with a BOM and uses CRLF line endings", () => {
    const csv = toCsv(["A"], [["x"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(body(csv)).toBe("A\r\nx\r\n");
  });

  it("quotes commas, quotes and new lines", () => {
    expect(body(toCsv(["A"], [['Cake, "large"\nslice']]))).toBe('A\r\n"Cake, ""large""\nslice"\r\n');
  });

  it.each(["=SUM(A1)", "+91", "-5", "@cmd", "\tx"])("defuses spreadsheet formulas: %s", (value) => {
    expect(body(toCsv(["A"], [[value]])).split("\r\n")[1]).toMatch(/^"?'/);
  });

  it("rounds numbers to 2 decimals", () => {
    expect(body(toCsv(["A"], [[1 / 3]]))).toBe("A\r\n0.33\r\n");
  });
});
