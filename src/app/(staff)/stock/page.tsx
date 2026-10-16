"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import ScanBill from "./ScanBill";
import BarcodeScanner from "./BarcodeScanner";
import { useT, type Key } from "@/lib/i18n";
import { CATEGORIES, UNITS, rupees, today, type Batch, type BatchInput, type Freshness } from "@/lib/schema";

type StockRow = Batch & { daysLeft: number; freshness: Freshness };

const GROUPS: { key: Freshness; title: Key; tone: string; dot: string }[] = [
  { key: "expired", title: "stock.group.expired", tone: "border-red-200 bg-red-50", dot: "bg-red-500" },
  { key: "today", title: "stock.group.today", tone: "border-orange-200 bg-orange-50", dot: "bg-orange-500" },
  { key: "soon", title: "stock.group.soon", tone: "border-amber-200 bg-amber-50", dot: "bg-amber-400" },
  { key: "fresh", title: "stock.group.fresh", tone: "border-stone-200 bg-white", dot: "bg-emerald-500" },
];

const plusDays = (n: number) => today(new Date(Date.now() + n * 86400000));

const emptyForm = () => ({ barcode: "", name: "", category: "bakery", unit: "pcs", quantity: "", unitCost: "", unitPrice: "", expiresOn: plusDays(1) });
type FormState = ReturnType<typeof emptyForm>;

function AddBatchForm({ onAdded }: { onAdded: () => void }) {
  const { t, category, unit } = useT();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [lookup, setLookup] = useState<{ tone: "ok" | "info"; text: string } | null>(null);
  const set = (k: keyof FormState) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  const quantityRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  /** Fills the form from what the shop (or Open Food Facts) knows about a barcode. */
  const lookUp = useCallback(async (raw: string) => {
    const barcode = raw.trim();
    setScanning(false);
    if (!barcode) return;
    setError("");
    setLookup({ tone: "info", text: t("add.lookingUp") });
    try {
      const p = await api<{ source: "shop" | "openfoodfacts" | "none"; name?: string; category?: string; unit?: string; unitCost?: number; unitPrice?: number; expiresOn?: string }>(
        `/api/products/${encodeURIComponent(barcode)}`,
      );
      setForm((f) => ({
        ...f,
        barcode,
        ...(p.source === "shop"
          ? { name: p.name!, category: p.category!, unit: p.unit!, unitCost: String(p.unitCost), unitPrice: String(p.unitPrice), expiresOn: p.expiresOn! }
          : p.source === "openfoodfacts"
            ? { name: p.name!, category: p.category!, unitCost: "", unitPrice: "" }
            : { name: "", unitCost: "", unitPrice: "" }),
      }));
      if (p.source === "shop") {
        setLookup({ tone: "ok", text: t("add.knownItem", { name: p.name! }) });
        setTimeout(() => quantityRef.current?.focus(), 0);
      } else {
        setLookup({
          tone: "info",
          text: p.source === "openfoodfacts" ? t("add.foundOff", { name: p.name! }) : t("add.newBarcode"),
        });
        setTimeout(() => (p.source === "none" ? nameRef : quantityRef).current?.focus(), 0);
      }
    } catch (err) {
      setLookup(null);
      setError((err as Error).message);
    }
  }, [t]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const body: BatchInput & { barcode?: string } = {
      ...(form.barcode.trim() ? { barcode: form.barcode.trim() } : {}),
      name: form.name.trim(),
      category: form.category as BatchInput["category"],
      unit: form.unit as BatchInput["unit"],
      quantity: Number(form.quantity),
      unitCost: Number(form.unitCost),
      unitPrice: Number(form.unitPrice),
      expiresOn: form.expiresOn,
    };
    if (!body.name || !(body.quantity > 0)) return setError(t("add.needNameQty"));
    if (body.unitPrice < body.unitCost) return setError(t("common.priceBelowCost"));
    setSaving(true);
    try {
      await api("/api/stock", { method: "POST", body: JSON.stringify(body) });
      // Keep category, unit and expiry: deliveries usually come in several similar items.
      setForm({ ...form, barcode: "", name: "", quantity: "", unitCost: "", unitPrice: "" });
      setLookup(null);
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
      <h2 className="font-semibold">{t("add.title")}</h2>
      <p className="text-sm text-stone-500">{t("add.subtitle")}</p>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="text-xs text-stone-500">
          {t("add.barcode")}
          <input
            className={`${input} w-48`}
            inputMode="numeric"
            placeholder={t("add.barcodePlaceholder")}
            value={form.barcode}
            onChange={set("barcode")}
            onKeyDown={(e) => {
              // USB/Bluetooth scanners type the code and press Enter.
              if (e.key === "Enter") {
                e.preventDefault();
                lookUp(form.barcode);
              }
            }}
            onBlur={() => form.barcode.trim() && !form.name && lookUp(form.barcode)}
          />
        </label>
        <button type="button" onClick={() => setScanning(true)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm hover:bg-stone-50">
          {t("add.scanBarcode")}
        </button>
        {lookup && <p className={`basis-full text-sm ${lookup.tone === "ok" ? "text-emerald-700" : "text-stone-600"}`}>{lookup.text}</p>}
      </div>
      {scanning && <BarcodeScanner onCode={lookUp} onClose={() => setScanning(false)} />}
      <div className="mt-4 grid gap-3 sm:grid-cols-6">
        <label className="sm:col-span-2 text-xs text-stone-500">
          {t("add.item")}
          <input ref={nameRef} className={input} placeholder={t("add.itemPlaceholder")} value={form.name} onChange={set("name")} />
        </label>
        <label className="text-xs text-stone-500">
          {t("add.category")}
          <select className={input} value={form.category} onChange={set("category")}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{category(c)}</option>)}
          </select>
        </label>
        <label className="text-xs text-stone-500">
          {t("add.quantity")}
          <div className="flex gap-1">
            <input ref={quantityRef} className={input} inputMode="decimal" placeholder="12" value={form.quantity} onChange={set("quantity")} />
            <select className="rounded-lg border border-stone-300 bg-white px-1 text-sm" value={form.unit} onChange={set("unit")}>
              {UNITS.map((u) => <option key={u} value={u}>{unit(u)}</option>)}
            </select>
          </div>
        </label>
        <label className="text-xs text-stone-500">
          {t("add.cost")}
          <input className={input} inputMode="decimal" placeholder="25" value={form.unitCost} onChange={set("unitCost")} />
        </label>
        <label className="text-xs text-stone-500">
          {t("add.price")}
          <input className={input} inputMode="decimal" placeholder="60" value={form.unitPrice} onChange={set("unitPrice")} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs text-stone-500">
          {t("add.expiresOn")}
          <input type="date" className={input} value={form.expiresOn} onChange={set("expiresOn")} />
        </label>
        <div className="flex gap-1.5 pb-1">
          {([["add.today", 0], ["add.tomorrow", 1], ["add.plus3", 3], ["add.plusWeek", 7]] as const).map(([label, n]) => (
            <button
              key={label}
              type="button"
              onClick={() => setForm({ ...form, expiresOn: plusDays(n) })}
              className={`rounded-full border px-2.5 py-1 text-xs ${form.expiresOn === plusDays(n) ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-stone-300 text-stone-600 hover:bg-stone-50"}`}
            >
              {t(label)}
            </button>
          ))}
        </div>
        <button disabled={saving} className="ml-auto rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
          {saving ? t("add.adding") : t("add.submit")}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </form>
  );
}

function EditLine({ b, onDone }: { b: StockRow; onDone: (saved: boolean) => void }) {
  const { t, category, unit } = useT();
  const [f, setF] = useState({
    name: b.name,
    category: b.category,
    unit: b.unit,
    quantity: String(b.quantity),
    unitCost: String(b.unitCost),
    unitPrice: String(b.unitPrice),
    expiresOn: b.expiresOn,
  });
  const [error, setError] = useState("");
  const hasHistory = b.remaining !== b.quantity;
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function save() {
    setError("");
    const body = { ...f, name: f.name.trim(), quantity: Number(f.quantity), unitCost: Number(f.unitCost), unitPrice: Number(f.unitPrice) };
    if (body.unitPrice < body.unitCost) return setError(t("common.priceBelowCost"));
    try {
      await api(`/api/stock/${b.id}`, { method: "PATCH", body: JSON.stringify(body) });
      onDone(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const input = "rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none";
  return (
    <li className="space-y-2 bg-white/70 px-4 py-3">
      <div className="flex flex-wrap items-end gap-2 text-xs text-stone-500">
        <label className="flex-1 min-w-40">{t("edit.item")}<input className={`${input} w-full`} value={f.name} onChange={set("name")} /></label>
        <label>
          {t("edit.category")}
          <select className={`${input} block`} value={f.category} onChange={set("category")}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{category(c)}</option>)}
          </select>
        </label>
        <label>
          {hasHistory ? t("edit.qtyReceived") : t("edit.quantity")}
          <div className="flex gap-1">
            <input className={`${input} w-16`} inputMode="decimal" value={f.quantity} onChange={set("quantity")} />
            <select className={input} value={f.unit} onChange={set("unit")} disabled={hasHistory} title={hasHistory ? t("edit.unitFixed") : undefined}>
              {UNITS.map((u) => <option key={u} value={u}>{unit(u)}</option>)}
            </select>
          </div>
        </label>
        <label>{t("edit.cost")}<input className={`${input} block w-20`} inputMode="decimal" value={f.unitCost} onChange={set("unitCost")} /></label>
        <label>{t("edit.price")}<input className={`${input} block w-20`} inputMode="decimal" value={f.unitPrice} onChange={set("unitPrice")} /></label>
        <label>{t("edit.expires")}<input type="date" className={`${input} block`} value={f.expiresOn} onChange={set("expiresOn")} /></label>
        <button onClick={save} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">{t("common.save")}</button>
        <button onClick={() => onDone(false)} className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50">{t("common.cancel")}</button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </li>
  );
}

function StockLine({ b, onChange }: { b: StockRow; onChange: () => void }) {
  const { t, category, unit, when } = useT();
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState("");
  const [error, setError] = useState("");
  const amount = qty === "" ? b.remaining : Number(qty);

  async function log(outcome: "sold" | "wasted" | "donated") {
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
    if (b.remaining !== b.quantity) return setError(t("stock.hasHistory"));
    await api(`/api/stock/${b.id}`, { method: "DELETE" }).then(onChange, (err) => setError(err.message));
  }

  if (editing) {
    return (
      <EditLine
        b={b}
        onDone={(saved) => {
          setEditing(false);
          if (saved) onChange();
        }}
      />
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-40 flex-1">
        <div className="font-medium">{b.name}</div>
        <div className="text-xs text-stone-500">
          {category(b.category)} · {rupees(b.unitPrice)}/{unit(b.unit)} · {b.freshness === "expired" ? t("stock.expiredAgo", { n: -b.daysLeft }) : t("stock.expires", { when: when(b.expiresOn) })}
        </div>
      </div>
      <div className="w-28 text-right">
        <div className="font-semibold tabular-nums">{b.remaining} {unit(b.unit)}</div>
        <div className="text-xs text-stone-500">{t("common.atCost", { amount: rupees(b.remaining * b.unitCost) })}</div>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          aria-label={t("stock.quantity")}
          inputMode="decimal"
          placeholder={`${b.remaining}`}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-16 rounded-lg border border-stone-300 px-2 py-1.5 text-sm"
        />
        {b.freshness !== "expired" && (
          <button onClick={() => log("sold")} className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm hover:bg-stone-50">{t("stock.sold")}</button>
        )}
        {b.freshness !== "expired" && (
          <button onClick={() => log("donated")} title={t("stock.donatedHint")} className="rounded-lg border border-sky-200 px-2.5 py-1.5 text-sm text-sky-700 hover:bg-sky-50">
            {t("stock.donated")}
          </button>
        )}
        <button onClick={() => log("wasted")} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-sm text-red-700 hover:bg-red-50">{t("stock.wasted")}</button>
        <button onClick={() => setEditing(true)} title={t("stock.edit")} className="px-1 text-stone-400 hover:text-stone-700">✎</button>
        <button onClick={remove} title={t("stock.delete")} className="px-1 text-stone-400 hover:text-stone-700">✕</button>
      </div>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </li>
  );
}

export default function StockPage() {
  const { t } = useT();
  const [rows, setRows] = useState<StockRow[] | null>(null);
  const load = useCallback(() => api<StockRow[]>("/api/stock").then(setRows, () => setRows([])), []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("stock.title")}</h1>
      <p className="text-sm text-stone-500">{t("stock.subtitle")}</p>

      {/* Rendered after the first load so date defaults use the shop's clock, not the server's. */}
      {rows !== null && (
        <div className="mt-6 space-y-4">
          <ScanBill onAdded={load} />
          <AddBatchForm onAdded={load} />
        </div>
      )}

      {rows === null && <p className="mt-10 text-center text-stone-500">{t("common.loading")}</p>}
      {rows?.length === 0 && <p className="mt-10 text-center text-stone-500">{t("stock.empty")}</p>}

      {GROUPS.map((g) => {
        const items = rows?.filter((r) => r.freshness === g.key) ?? [];
        if (!items.length) return null;
        return (
          <section key={g.key} className={`mt-6 rounded-2xl border ${g.tone}`}>
            <h2 className="flex items-center gap-2 px-4 pt-3 text-sm font-semibold">
              <span className={`h-2.5 w-2.5 rounded-full ${g.dot}`} />
              {t(g.title)}
              <span className="font-normal text-stone-500">
                · {items.length === 1 ? t("stock.item") : t("stock.items", { n: items.length })} · {t("common.atCost", { amount: rupees(items.reduce((s, b) => s + b.remaining * b.unitCost, 0)) })}
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
