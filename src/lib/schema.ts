import { z } from "zod";

export const CATEGORIES = ["bakery", "dairy", "produce", "beverages", "prepared", "packaged"] as const;
export const UNITS = ["pcs", "kg", "L", "pack"] as const;
export type Category = (typeof CATEGORIES)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

// One delivery or production run of an item, with a single expiry date.
// Prices are per unit, in rupees.
export const BatchInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  category: z.enum(CATEGORIES),
  unit: z.enum(UNITS),
  quantity: z.number().positive().max(10000),
  unitCost: z.number().min(0).max(100000),
  unitPrice: z.number().min(0).max(100000),
  expiresOn: isoDate,
});
export type BatchInput = z.infer<typeof BatchInputSchema>;

export type Batch = BatchInput & {
  id: string;
  addedOn: string;
  /** Quantity not yet sold, wasted or put in a bundle. */
  remaining: number;
};

// What happened to some of a batch. "rescued" = sold as part of a rescue bundle.
export const OUTCOMES = ["sold", "wasted", "rescued"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const OutcomeInputSchema = z.object({
  outcome: z.enum(OUTCOMES),
  quantity: z.number().positive(),
});

export type BundleItem = { batchId: string; name: string; quantity: number; unit: string };

export type Bundle = {
  id: string;
  title: string;
  description: string;
  items: BundleItem[];
  /** Sum of the items' normal prices. */
  originalPrice: number;
  price: number;
  status: "active" | "sold" | "cancelled";
  soldCount: number;
  /** The bundle can't outlive its earliest-expiring item. */
  expiresOn: string;
  createdAt: string;
};

// ---- Expiry helpers ----

/** Today's date as YYYY-MM-DD in the shop's local time zone. */
export function today(now = new Date()) {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/** Whole days from today until the expiry date; negative once expired. */
export function daysLeft(expiresOn: string, from = today()) {
  return Math.round((Date.parse(expiresOn) - Date.parse(from)) / 86400000);
}

export type Freshness = "expired" | "today" | "soon" | "fresh";

/** "soon" = within 2 days, the window in which a rescue bundle still makes sense. */
export function freshness(expiresOn: string, from = today()): Freshness {
  const d = daysLeft(expiresOn, from);
  if (d < 0) return "expired";
  if (d === 0) return "today";
  if (d <= 2) return "soon";
  return "fresh";
}

export const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** "today", "tomorrow", or a short date like "Sun, 18 Oct". */
export function expiryLabel(expiresOn: string, from = today()) {
  const d = daysLeft(expiresOn, from);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  return new Date(expiresOn + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}
