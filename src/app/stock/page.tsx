"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { CATEGORIES, UNITS, expiryLabel, rupees, today, type Batch, type BatchInput, type Freshness } from "@/lib/schema";

type StockRow = Batch & { daysLeft: number; freshness: Freshness };

const GROUPS: { key: Freshness; title: string; tone: string; dot: string }[] = [
  { key: "expired", title: "Expired: log as wasted", tone: "border-red-200 bg-red-50", dot: "bg-red-500" },
  { key: "today", title: "Expires today", tone: "border-orange-200 bg-orange-50", dot: "bg-orange-500" },
  { key: "soon", title: "Expires in 1–2 days", tone: "border-amber-200 bg-amber-50", dot: "bg-amber-400" },
  { key: "fresh", title: "Fresh", tone: "border-stone-200 bg-white", dot: "bg-emerald-500" },
];

const plusDays = (n: number) => today(new Date(Date.now() + n * 86400000));

const emptyForm = () => ({ name: "", category: "bakery", unit: "pcs", quantity: "", unitCost: "", unitPrice: "", expiresOn: plusDays(1) });
type FormState = ReturnType<typeof emptyForm>;

function AddBatchForm({ onAdded }: { onAdded: () => void }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: keyof FormState) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const body: BatchInput = {
      name: form.name.trim(),
      category: form.category as BatchInput["category"],
      unit: form.unit as BatchInput["unit"],
      quantity: Number(form.quantity),
      unitCost: Number(form.unitCost),
      unitPrice: Number(form.unitPrice),
      expiresOn: form.expiresOn,
    };
    if (!body.name || !(body.quantity > 0)) return setError("Add a name and a quantity.");
    if (body.unitPrice < body.unitCost) return setError("Selling price is below cost. Double-check the prices.");
    setSaving(true);
    try {
      await api("/api/stock", { method: "POST", body: JSON.stringify(body) });
      // Keep category, unit and expiry: deliveries usually come in several similar items.
      setForm({ ...form, name: "", quantity: "", unitCost: "", unitPrice: "" });
      onAdded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const input = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none";
  return (
    <form onSubmit={submit} className="rounded-2xl border border-stone-200 bg-white p-5">
      <h2 className="font-semibold">Add stock</h2>
      <p className="text-sm text-stone-500">One line per delivery or bake, with its expiry date.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-6">
        <label className="sm:col-span-2 text-xs text-stone-500">
          Item
          <input className={input} placeholder="e.g. Croissant" value={form.name} onChange={set("name")} />
        </label>
        <label className="text-xs text-stone-500">
          Category
          <select className={input} value={form.category} onChange={set("category")}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="text-xs text-stone-500">
          Quantity
          <div className="flex gap-1">
            <input className={input} inputMode="decimal" placeholder="12" value={form.quantity} onChange={set("quantity")} />
            <select className="rounded-lg border border-stone-300 bg-white px-1 text-sm" value={form.unit} onChange={set("unit")}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </label>
        <label className="text-xs text-stone-500">
          Cost / unit (₹)
          <input className={input} inputMode="decimal" placeholder="25" value={form.unitCost} onChange={set("unitCost")} />
        </label>
        <label className="text-xs text-stone-500">
          Price / unit (₹)
          <input className={input} inputMode="decimal" placeholder="60" value={form.unitPrice} onChange={set("unitPrice")} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs text-stone-500">
          Expires on
          <input type="date" className={input} value={form.expiresOn} onChange={set("expiresOn")} />
        </label>
        <div className="flex gap-1.5 pb-1">
          {[["Today", 0], ["Tomorrow", 1], ["+3 days", 3], ["+1 week", 7]].map(([label, n]) => (
            <button
              key={label}
              type="button"
              onClick={() => setForm({ ...form, expiresOn: plusDays(n as number) })}
              className={`rounded-full border px-2.5 py-1 text-xs ${form.expiresOn === plusDays(n as number) ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-stone-300 text-stone-600 hover:bg-stone-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button disabled={saving} className="ml-auto rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
          {saving ? "Adding…" : "Add to stock"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </form>
  );
}

function StockLine({ b, onChange }: { b: StockRow; onChange: () => void }) {
  const [qty, setQty] = useState("");
  const [error, setError] = useState("");
  const amount = qty === "" ? b.remaining : Number(qty);

  async function log(outcome: "sold" | "wasted") {
    setError("");
    try {
      await api(`/api/stock/${b.id}/outcome`, { method: "POST", body: JSON.stringify({ outcome, quantity: amount }) });
      setQty("");
      onChange();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove() {
    if (b.remaining !== b.quantity) return setError("This batch has history, so log it as sold or wasted instead.");
    await api(`/api/stock/${b.id}`, { method: "DELETE" }).then(onChange, (err) => setError(err.message));
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-40 flex-1">
        <div className="font-medium">{b.name}</div>
        <div className="text-xs text-stone-500">
          {b.category} · {rupees(b.unitPrice)}/{b.unit} · {b.freshness === "expired" ? `expired ${-b.daysLeft}d ago` : `expires ${expiryLabel(b.expiresOn)}`}
        </div>
      </div>
      <div className="w-28 text-right">
        <div className="font-semibold tabular-nums">{b.remaining} {b.unit}</div>
        <div className="text-xs text-stone-500">{rupees(b.remaining * b.unitCost)} at cost</div>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          aria-label="Quantity"
          inputMode="decimal"
          placeholder={`${b.remaining}`}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-16 rounded-lg border border-stone-300 px-2 py-1.5 text-sm"
        />
        {b.freshness !== "expired" && (
          <button onClick={() => log("sold")} className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm hover:bg-stone-50">Sold</button>
        )}
        <button onClick={() => log("wasted")} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-sm text-red-700 hover:bg-red-50">Wasted</button>
        <button onClick={remove} title="Delete (entered by mistake)" className="px-1.5 text-stone-400 hover:text-stone-700">✕</button>
      </div>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </li>
  );
}

export default function StockPage() {
  const [rows, setRows] = useState<StockRow[] | null>(null);
  const load = useCallback(() => api<StockRow[]>("/api/stock").then(setRows, () => setRows([])), []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Stock</h1>
      <p className="text-sm text-stone-500">Soonest expiry first. Leave the quantity empty to log the whole batch.</p>

      {/* Rendered after the first load so date defaults use the shop's clock, not the server's. */}
      {rows !== null && (
        <div className="mt-6">
          <AddBatchForm onAdded={load} />
        </div>
      )}

      {rows === null && <p className="mt-10 text-center text-stone-500">Loading…</p>}
      {rows?.length === 0 && <p className="mt-10 text-center text-stone-500">No stock yet. Add your first delivery above.</p>}

      {GROUPS.map((g) => {
        const items = rows?.filter((r) => r.freshness === g.key) ?? [];
        if (!items.length) return null;
        return (
          <section key={g.key} className={`mt-6 rounded-2xl border ${g.tone}`}>
            <h2 className="flex items-center gap-2 px-4 pt-3 text-sm font-semibold">
              <span className={`h-2.5 w-2.5 rounded-full ${g.dot}`} />
              {g.title}
              <span className="font-normal text-stone-500">
                · {items.length} item{items.length > 1 ? "s" : ""} · {rupees(items.reduce((s, b) => s + b.remaining * b.unitCost, 0))} at cost
              </span>
            </h2>
            <ul className="divide-y divide-stone-200/70">
              {items.map((b) => <StockLine key={b.id} b={b} onChange={load} />)}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
