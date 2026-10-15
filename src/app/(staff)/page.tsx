"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { rupees } from "@/lib/schema";

type Totals = { quantity: number; cost: number; revenue: number };
type Report = {
  days: number;
  sold: Totals;
  wasted: Totals;
  rescued: Totals;
  atRisk: { batches: number; cost: number };
  expired: { batches: number; cost: number };
};

function Card({ label, value, note, tone = "" }: { label: string; value: string; note: React.ReactNode; tone?: string }) {
  return (
    <div className={`rounded-2xl border p-5 ${tone || "border-stone-200 bg-white"}`}>
      <div className="text-sm text-stone-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-sm text-stone-500">{note}</div>
    </div>
  );
}

export default function Dashboard() {
  const [days, setDays] = useState(7);
  const [r, setR] = useState<Report | null>(null);

  useEffect(() => {
    api<Report>(`/api/report?days=${days}`).then(setR, () => setR(null));
  }, [days]);

  // Of everything that reached its end of life (wasted or rescued), how much was saved.
  const atEnd = r ? r.wasted.quantity + r.rescued.quantity : 0;
  const rescueRate = r && atEnd ? Math.round((r.rescued.quantity / atEnd) * 100) : null;

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      <h2 className="mt-6 font-semibold">Right now</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Card
          label="At risk (expires within 2 days)"
          value={r ? rupees(r.atRisk.cost) : "–"}
          tone={r?.atRisk.batches ? "border-orange-200 bg-orange-50" : ""}
          note={
            r?.atRisk.batches ? (
              <>
                {r.atRisk.batches} item{r.atRisk.batches > 1 ? "s" : ""} at cost.{" "}
                <Link href="/bundles" className="font-medium text-emerald-700 underline">Make rescue bundles →</Link>
              </>
            ) : (
              "Nothing close to expiry."
            )
          }
        />
        <Card
          label="Expired, not yet logged"
          value={r ? rupees(r.expired.cost) : "–"}
          tone={r?.expired.batches ? "border-red-200 bg-red-50" : ""}
          note={
            r?.expired.batches ? (
              <>
                {r.expired.batches} item{r.expired.batches > 1 ? "s" : ""}.{" "}
                <Link href="/stock" className="font-medium text-red-700 underline">Log as wasted →</Link>
              </>
            ) : (
              "All clear."
            )
          }
        />
      </div>

      <div className="mt-8 flex items-center gap-3">
        <h2 className="font-semibold">Last {days} days</h2>
        <div className="ml-auto flex rounded-lg border border-stone-300 bg-white p-0.5 text-sm">
          {[7, 30].map((d) => (
            <button key={d} onClick={() => setDays(d)} className={`rounded-md px-3 py-1 ${d === days ? "bg-stone-900 text-white" : "text-stone-600"}`}>
              {d} days
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <Card
          label="Rescued with bundles"
          value={r ? rupees(r.rescued.revenue) : "–"}
          tone="border-emerald-200 bg-emerald-50"
          note={r ? `Taken for stock that cost ${rupees(r.rescued.cost)}` : ""}
        />
        <Card label="Wasted" value={r ? rupees(r.wasted.cost) : "–"} note="Thrown away, valued at cost" />
        <Card
          label="Rescue rate"
          value={rescueRate === null ? "–" : `${rescueRate}%`}
          note="Share of end-of-life stock sold in bundles instead of binned"
        />
      </div>
      {r && (
        <p className="mt-4 text-sm text-stone-500">
          Regular sales: {rupees(r.sold.revenue)} from {r.sold.quantity} units logged as sold.
        </p>
      )}
    </div>
  );
}
