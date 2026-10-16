"use client";

import { useState } from "react";

/** Monthly spreadsheets for the accountant. */
export default function Export() {
  // The last 12 months, newest first, as YYYY-MM.
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    return { value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }) };
  });
  const [month, setMonth] = useState(months[0].value);
  const link = "rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50";
  return (
    <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-5">
      <h2 className="font-semibold">Export for your accountant</h2>
      <p className="text-sm text-stone-500">Spreadsheet files (CSV) that open in Excel or Google Sheets.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm">
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <a href={`/api/export?month=${month}&type=activity`} className={link}>
          ⬇ Stock activity
        </a>
        <a href={`/api/export?month=${month}&type=bundle-sales`} className={link}>
          ⬇ Bundle sales
        </a>
      </div>
      <p className="mt-2 text-xs text-stone-400">
        Stock activity: every unit sold, sold in a bundle, donated or wasted, with its cost. Bundle sales: what customers paid for each bundle.
      </p>
    </section>
  );
}
