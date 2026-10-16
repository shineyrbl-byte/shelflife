import { connection } from "next/server";
import { requireOwner } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { listActivity, listBundleSales } from "@/lib/db";

// Dates and times in the export are shown in the shop's time zone (India by default).
const TIME_ZONE = process.env.APP_TIMEZONE || "Asia/Kolkata";
const local = (iso: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
};

const OUTCOME_LABEL = { sold: "Sold", rescued: "Sold in bundle", donated: "Donated", wasted: "Wasted" } as const;

/**
 * Owner: a month of data as CSV for the accountant.
 *   ?month=2026-10&type=activity      every unit sold / bundled / donated / wasted, with cost and price
 *   ?month=2026-10&type=bundle-sales  what customers paid for each rescue bundle
 */
export async function GET(req: Request) {
  await connection();
  const session = await requireOwner();
  if (session instanceof Response) return session;
  const params = new URL(req.url).searchParams;
  const month = params.get("month") ?? "";
  const type = params.get("type") ?? "activity";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !["activity", "bundle-sales"].includes(type)) {
    return Response.json({ error: "Use ?month=YYYY-MM&type=activity or bundle-sales" }, { status: 400 });
  }
  // The month's boundaries in the shop's time zone, as UTC timestamps (data is stored in UTC).
  const [y, m] = month.split("-").map(Number);
  const offset = (d: Date) => {
    const shown = new Date(d.toLocaleString("en-US", { timeZone: TIME_ZONE }));
    return shown.getTime() - new Date(d.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  };
  const startUtc = (yy: number, mm: number) => {
    const guess = new Date(Date.UTC(yy, mm - 1, 1));
    return new Date(guess.getTime() - offset(guess)).toISOString();
  };
  const from = startUtc(y, m);
  const to = m === 12 ? startUtc(y + 1, 1) : startUtc(y, m + 1);

  let csv: string;
  if (type === "activity") {
    const rows = await listActivity(session.shop.id, from, to);
    csv = toCsv(
      ["Date", "Time", "Item", "Category", "What happened", "Quantity", "Unit", "Cost per unit (₹)", "Normal price per unit (₹)", "Value at cost (₹)", "Bundle", "Expiry date"],
      rows.map((r) => {
        const t = local(r.at);
        return [t.date, t.time, r.name, r.category, OUTCOME_LABEL[r.outcome], r.quantity, r.unit, r.unitCost, r.unitPrice, r.quantity * r.unitCost, r.bundleTitle, r.expiresOn];
      }),
    );
  } else {
    const rows = await listBundleSales(session.shop.id, from, to);
    csv = toCsv(
      ["Date", "Time", "Bundle", "Price paid (₹)", "Normal price (₹)", "Discount (₹)"],
      rows.map((r) => {
        const t = local(r.at);
        return [t.date, t.time, r.title, r.price, r.originalPrice, r.originalPrice - r.price];
      }),
    );
  }
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="shelflife-${session.shop.slug}-${type}-${month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
