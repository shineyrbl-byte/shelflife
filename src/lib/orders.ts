import type { BatchHistory } from "./db";
import { orderTips } from "./insights";
import { today } from "./schema";

// Planning tomorrow's order: what each item usually is, what the waste history suggests,
// and a WhatsApp message per supplier. Pure functions, so they're easy to test.

export const itemKey = (name: string) => name.trim().toLowerCase();

/**
 * A WhatsApp number in international form without "+", e.g. "919876543210". Numbers without a
 * country code are taken as Indian. Returns null if it can't be a phone number.
 */
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = "91" + digits.slice(1);
  else if (digits.length === 10) digits = "91" + digits;
  digits = digits.replace(/\D/g, "");
  return /^[1-9]\d{10,14}$/.test(digits) ? digits : null;
}

export type PlanItem = { key: string; name: string; unit: string; avgOrder: number; suggested: number; fromTip: boolean };

/** One line per item the shop stocked recently: the usual order, and the tip's quantity when there is one. */
export function planItems(history: BatchHistory[], day = today()): PlanItem[] {
  const tips = new Map(orderTips(history, day).map((t) => [itemKey(t.name), t]));
  const byItem = new Map<string, BatchHistory[]>();
  for (const b of history) byItem.set(itemKey(b.name), [...(byItem.get(itemKey(b.name)) ?? []), b]);
  return [...byItem.entries()]
    .map(([key, bs]) => {
      const latest = bs.reduce((a, b) => (b.addedOn > a.addedOn ? b : a));
      const avgOrder = Math.round((bs.reduce((s, b) => s + b.quantity, 0) / bs.length) * 10) / 10;
      const tip = tips.get(key);
      const step = latest.unit === "pcs" || latest.unit === "pack" ? 1 : 0.5;
      return {
        key,
        name: latest.name,
        unit: latest.unit,
        avgOrder,
        suggested: tip ? tip.suggested : Math.round(avgOrder / step) * step,
        fromTip: Boolean(tip),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function orderMessage(p: { supplierName: string; shopName: string; forDay: string; lines: { name: string; quantity: number; unit: string }[] }) {
  const lines = p.lines.map((l) => `• ${l.quantity} ${l.unit} ${l.name}`).join("\n");
  return `Hi ${p.supplierName}, this is ${p.shopName}. Please send for ${p.forDay}:\n\n${lines}\n\nThank you!`;
}

/** wa.me link that opens WhatsApp to that number with the message typed in. */
export const whatsappUrl = (phone: string, text: string) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
