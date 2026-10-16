"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import type { ItemInsight, OrderTip } from "@/lib/insights";
import { rupees } from "@/lib/schema";

type Insights = { days: number; items: ItemInsight[]; tips: OrderTip[]; weekdays: { day: string; cost: number }[] };

function WeekdayChart({ weekdays }: { weekdays: Insights["weekdays"] }) {
  const max = Math.max(...weekdays.map((w) => w.cost), 1);
  const total = weekdays.reduce((s, w) => s + w.cost, 0);
  const worst = weekdays.reduce((a, b) => (b.cost > a.cost ? b : a));
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5">
      <h2 className="font-semibold">Waste by day of the week</h2>
      <p className="text-sm text-stone-500">
        {total > 0 ? (
          <>
            <b className="text-stone-800">{worst.day}</b> is your worst day: {rupees(worst.cost)}, {Math.round((worst.cost / total) * 100)}% of all waste. Check what you bake or order for that day and the day before.
          </>
        ) : (
          "No waste logged yet."
        )}
      </p>
      <div className="mt-5 flex h-40 items-end gap-3">
        {weekdays.map((w) => (
          <div key={w.day} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="text-xs tabular-nums text-stone-500">{w.cost ? rupees(w.cost) : ""}</div>
            <div
              className={`w-full rounded-t-md ${w === worst && total ? "bg-red-500" : "bg-stone-300"}`}
              style={{ height: `${(w.cost / max) * 100}%`, minHeight: w.cost ? 4 : 0 }}
            />
            <div className="text-xs font-medium text-stone-600">{w.day}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ItemTable({ items }: { items: ItemInsight[] }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white">
      <div className="p-5 pb-3">
        <h2 className="font-semibold">Where the stock goes, by item</h2>
        <p className="text-sm text-stone-500">Finished batches only. Most waste first.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-xs uppercase text-stone-500">
            <tr>
              <th className="px-5 py-2">Item</th>
              <th className="px-3 py-2 text-right">Ordered</th>
              <th className="px-3 py-2 w-56">Full price · bundles · donated · bin</th>
              <th className="px-3 py-2 text-right">Wasted</th>
              <th className="px-5 py-2 text-right">Waste cost</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const pct = (n: number) => `${it.ordered ? (n / it.ordered) * 100 : 0}%`;
              return (
                <tr key={it.name} className="border-t border-stone-100">
                  <td className="px-5 py-2.5">
                    <div className="font-medium">{it.name}</div>
                    <div className="text-xs text-stone-500">{it.batches} batches</div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{it.ordered} {it.unit}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-stone-100" title={`${it.sold} sold · ${it.rescued} rescued · ${it.donated} donated · ${it.wasted} wasted`}>
                      <div className="bg-emerald-500" style={{ width: pct(it.sold) }} />
                      <div className="bg-amber-400" style={{ width: pct(it.rescued) }} />
                      <div className="bg-sky-400" style={{ width: pct(it.donated) }} />
                      <div className="bg-red-500" style={{ width: pct(it.wasted) }} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{it.wasted} {it.unit}</td>
                  <td className="px-5 py-2.5 text-right font-semibold tabular-nums">{rupees(it.wasteCost)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex gap-4 px-5 py-3 text-xs text-stone-500">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />Sold at full price</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />Rescued in bundles</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-400" />Donated</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" />Wasted</span>
      </div>
    </section>
  );
}

export default function InsightsPage() {
  const [data, setData] = useState<Insights | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api<Insights>("/api/insights").then(setData, () => setFailed(true));
  }, []);

  const totalSaving = data?.tips.reduce((s, t) => s + t.monthlySaving, 0) ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
      <p className="text-sm text-stone-500">What you waste, when, and how much to order instead. Based on the last {data?.days ?? 28} days.</p>

      {!data && !failed && <p className="mt-10 text-center text-stone-500">Crunching your history…</p>}
      {failed && <p className="mt-10 text-center text-red-600">Couldn&apos;t load insights. Refresh to try again.</p>}
      {data && data.items.length === 0 && (
        <p className="mt-8 rounded-2xl border border-dashed border-stone-300 p-8 text-center text-stone-500">
          Not enough history yet. Insights appear once batches have sold out or expired. Keep logging on the{" "}
          <Link href="/stock" className="text-emerald-700 underline">Stock page</Link>.
        </p>
      )}

      {data && data.items.length > 0 && (
        <div className="mt-6 space-y-6">
          <section>
            <h2 className="font-semibold">Ordering tips</h2>
            {data.tips.length === 0 ? (
              <p className="mt-2 text-sm text-stone-500">No changes needed: everything with 3+ batches sells at least 85% at full price.</p>
            ) : (
              <>
                <p className="text-sm text-stone-500">
                  Following these could save about <b className="text-emerald-700">{rupees(totalSaving)} a month</b> in stock you don&apos;t sell at full price.
                </p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {data.tips.map((t) => (
                    <div key={t.name} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                      <div className="text-sm text-emerald-800">{t.name}</div>
                      <div className="mt-1 text-xl font-semibold">
                        Order {t.suggested} {t.unit}, not {t.avgOrder}
                      </div>
                      <p className="mt-1 text-sm text-stone-600">{t.reason}</p>
                      <p className="mt-2 text-sm font-medium text-emerald-700">Saves about {rupees(t.monthlySaving)} a month</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
          <WeekdayChart weekdays={data.weekdays} />
          <ItemTable items={data.items} />
        </div>
      )}
    </div>
  );
}
