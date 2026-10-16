"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { orderMessage, whatsappUrl } from "@/lib/orders";

type Supplier = { id: string; name: string; phone: string };
type Item = { key: string; name: string; unit: string; avgOrder: number; suggested: number; fromTip: boolean; supplierId: string | null };
type Plan = { shopName: string; suppliers: Supplier[]; items: Item[] };

/** "+91 98765 43210" for display. */
const showPhone = (p: string) => (p.startsWith("91") && p.length === 12 ? `+91 ${p.slice(2, 7)} ${p.slice(7)}` : `+${p}`);

function Suppliers({ suppliers, onChange }: { suppliers: Supplier[]; onChange: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/suppliers", { method: "POST", body: JSON.stringify({ name, phone }) });
      setName("");
      setPhone("");
      onChange();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(s: Supplier) {
    if (!window.confirm(`Remove ${s.name}? Items ordered from them will need a new supplier.`)) return;
    await api(`/api/suppliers/${s.id}`, { method: "DELETE" }).then(onChange, (err) => setError(err.message));
  }

  const input = "rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none";
  return (
    <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-5">
      <h2 className="font-semibold">Suppliers</h2>
      {suppliers.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {suppliers.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 py-1 pl-3 pr-1 text-sm">
              <span className="font-medium">{s.name}</span>
              <span className="text-stone-500">{showPhone(s.phone)}</span>
              <button onClick={() => remove(s)} title={`Remove ${s.name}`} className="rounded-full px-2 text-stone-400 hover:bg-stone-200 hover:text-stone-700">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="mt-3 flex flex-wrap gap-2">
        <input className={`${input} w-40`} placeholder="Name, e.g. Rahul" required value={name} onChange={(e) => setName(e.target.value)} />
        <input className={`${input} w-48`} placeholder="WhatsApp number" inputMode="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button className="rounded-lg border border-stone-300 px-3 py-2 text-sm hover:bg-stone-50">+ Add supplier</button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}

/** One supplier's order: an editable message and a button that opens WhatsApp with it. */
function SupplierOrder({ supplier, text }: { supplier: Supplier; text: string }) {
  const [edited, setEdited] = useState<string | null>(null);
  const message = edited ?? text;
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">{supplier.name}</h3>
        <span className="text-sm text-stone-500">{showPhone(supplier.phone)}</span>
        {edited !== null && (
          <button onClick={() => setEdited(null)} className="ml-auto text-xs text-stone-500 underline">
            Undo my edits
          </button>
        )}
      </div>
      <textarea
        aria-label={`Message to ${supplier.name}`}
        rows={Math.min(14, message.split("\n").length + 1)}
        value={message}
        onChange={(e) => setEdited(e.target.value)}
        className="mt-3 w-full rounded-lg border border-stone-200 bg-white p-3 text-sm focus:border-emerald-500 focus:outline-none"
      />
      <a
        href={whatsappUrl(supplier.phone, message)}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-block rounded-lg bg-[#25D366] px-4 py-2 text-sm font-medium text-white hover:brightness-95"
      >
        Send to {supplier.name} on WhatsApp
      </a>
    </div>
  );
}

export default function OrdersPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [forDay, setForDay] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const load = useCallback(
    () =>
      api<Plan>("/api/orders").then((p) => {
        setPlan(p);
        // Tomorrow, in words; computed here (in the browser) rather than while rendering.
        setForDay(new Date(Date.now() + 86400000).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }));
      }, (err) => setError(err.message)),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);

  async function assign(item: Item, supplierId: string) {
    setError("");
    try {
      await api("/api/orders/assign", { method: "PUT", body: JSON.stringify({ item: item.name, supplierId: supplierId || null }) });
      setPlan((p) => p && { ...p, items: p.items.map((i) => (i.key === item.key ? { ...i, supplierId: supplierId || null } : i)) });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!plan) return <p className="py-24 text-center text-stone-500">{error || "Loading…"}</p>;

  const quantity = (i: Item) => (qty[i.key] === undefined ? i.suggested : Number(qty[i.key]) || 0);
  const bySupplier = plan.suppliers
    .map((s) => ({ supplier: s, lines: plan.items.filter((i) => i.supplierId === s.id && quantity(i) > 0) }))
    .filter((g) => g.lines.length > 0);
  const unassigned = plan.items.filter((i) => !i.supplierId && quantity(i) > 0);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Tomorrow&apos;s order</h1>
      <p className="text-sm text-stone-500">
        Suggested from the last 4 weeks: the ordering tip where there is one (see <Link href="/insights" className="underline">Insights</Link>), otherwise
        your usual order. Change any number, then send each supplier their list on WhatsApp.
      </p>

      <Suppliers suppliers={plan.suppliers} onChange={load} />

      {plan.items.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
          Nothing to plan yet. Items you add on the <Link href="/stock" className="underline">Stock page</Link> show up here.
        </p>
      ) : (
        <section className="mt-6 overflow-x-auto rounded-2xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-5 py-2">Item</th>
                <th className="px-3 py-2 text-right">Usual</th>
                <th className="px-3 py-2">Order for {forDay}</th>
                <th className="px-5 py-2">Supplier</th>
              </tr>
            </thead>
            <tbody>
              {plan.items.map((i) => (
                <tr key={i.key} className="border-t border-stone-100">
                  <td className="px-5 py-2.5 font-medium">{i.name}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-stone-500">
                    {i.avgOrder} {i.unit}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <input
                        aria-label={`Quantity of ${i.name}`}
                        inputMode="decimal"
                        value={qty[i.key] ?? String(i.suggested)}
                        onChange={(e) => setQty({ ...qty, [i.key]: e.target.value })}
                        className="w-20 rounded-lg border border-stone-300 px-2 py-1.5"
                      />
                      <span className="text-stone-500">{i.unit}</span>
                      {i.fromTip && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700" title="Lower than usual, based on what actually sold">
                          tip
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-2.5">
                    <select
                      aria-label={`Supplier for ${i.name}`}
                      value={i.supplierId ?? ""}
                      onChange={(e) => assign(i, e.target.value)}
                      className="rounded-lg border border-stone-300 bg-white px-2 py-1.5"
                    >
                      <option value="">{plan.suppliers.length ? "Choose…" : "Add a supplier first"}</option>
                      {plan.suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {bySupplier.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold">Messages to send</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {bySupplier.map(({ supplier, lines }) => (
              <SupplierOrder
                // Re-created when the list changes, so an old manual edit doesn't hide a new item.
                key={`${supplier.id}:${lines.map((l) => `${l.key}=${quantity(l)}`).join()}`}
                supplier={supplier}
                text={orderMessage({
                  supplierName: supplier.name,
                  shopName: plan.shopName,
                  forDay,
                  lines: lines.map((l) => ({ name: l.name, quantity: quantity(l), unit: l.unit })),
                })}
              />
            ))}
          </div>
        </section>
      )}
      {unassigned.length > 0 && plan.suppliers.length > 0 && (
        <p className="mt-4 text-sm text-stone-500">Not in any message yet (no supplier chosen): {unassigned.map((i) => i.name).join(", ")}.</p>
      )}
    </div>
  );
}
