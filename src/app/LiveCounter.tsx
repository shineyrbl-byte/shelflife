"use client";

import { useEffect, useState } from "react";

type Stats = { shops: number; kgRescued: number; co2Kg: number; bundlesSold: number };

/** Live totals across every shop using ShelfLife. Hidden until there's something worth showing. */
export default function LiveCounter() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    fetch("/api/public/stats")
      .then((res) => (res.ok ? res.json() : null))
      .then(setStats, () => setStats(null));
  }, []);
  if (!stats || stats.kgRescued < 1) return null;
  const items: [string, string][] = [
    [`${Math.round(stats.kgRescued).toLocaleString("en-IN")} kg`, "food rescued"],
    [`${stats.co2Kg.toLocaleString("en-IN")} kg`, "CO₂ avoided (est.)"],
    [stats.bundlesSold.toLocaleString("en-IN"), "rescue bundles sold"],
    [stats.shops.toLocaleString("en-IN"), stats.shops === 1 ? "shop" : "shops"],
  ];
  return (
    <div className="px-5">
      <div className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-6 rounded-2xl border border-emerald-200 bg-white/70 p-6 text-center sm:grid-cols-4">
        {items.map(([value, label]) => (
          <div key={label}>
            <div className="text-2xl font-semibold tabular-nums text-emerald-800">{value}</div>
            <div className="text-xs text-stone-500">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
