"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/client";
import { useT } from "@/lib/i18n";
import { CATEGORIES, UNITS, rupees, type BatchInput } from "@/lib/schema";

type Line = BatchInput & { include: boolean };

/** Shrinks big phone photos before upload: faster, cheaper, and plenty sharp for reading text. */
async function shrink(file: File, maxSide = 1800): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 2_000_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.85));
  } catch {
    return file; // e.g. HEIC on browsers that can't decode it: send as is, the server accepts it
  }
}

export default function ScanBill({ onAdded }: { onAdded: () => void }) {
  const { t, category, unit } = useT();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "reading" | "review" | "saving">("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [supplier, setSupplier] = useState("");
  const [error, setError] = useState("");

  async function scan(file: File) {
    setError("");
    setStatus("reading");
    try {
      const form = new FormData();
      const blob = await shrink(file);
      form.append("photo", blob, blob === file ? file.name : "bill.jpg");
      const res = await fetch("/api/stock/scan", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Scan failed (${res.status})`);
      setSupplier(data.supplier);
      setLines(data.items.map((i: BatchInput) => ({ ...i, include: true })));
      setStatus("review");
    } catch (err) {
      setError((err as Error).message);
      setStatus("idle");
    }
  }

  const update = (i: number, patch: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const chosen = lines.filter((l) => l.include);

  async function addAll() {
    setError("");
    const bad = chosen.find((l) => !l.name.trim() || !(l.quantity > 0) || l.unitPrice < l.unitCost);
    if (bad) return setError(t("bill.checkLine", { name: bad.name || t("bill.unnamed") }));
    setStatus("saving");
    try {
      await api("/api/stock/bulk", { method: "POST", body: JSON.stringify({ items: chosen.map(({ include, ...l }) => (void include, l)) }) });
      setLines([]);
      setStatus("idle");
      onAdded();
    } catch (err) {
      setError((err as Error).message);
      setStatus("review");
    }
  }

  const cell = "w-full rounded-md border border-stone-200 bg-white px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none";
  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="font-semibold">{t("bill.title")}</h2>
          <p className="text-sm text-stone-500">{t("bill.subtitle")}</p>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) scan(f);
          }}
        />
        <button
          onClick={() => input.current?.click()}
          disabled={status === "reading" || status === "saving"}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {status === "reading" ? t("bill.reading") : status === "review" ? t("bill.another") : t("bill.scan")}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {status !== "idle" && status !== "reading" && lines.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-stone-600">
            {t("bill.found", { n: lines.length })}
            {supplier ? t("bill.from", { supplier }) : ""}. <b>{t("bill.checkBoth")}</b>
          </p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-stone-200 bg-white">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-3 py-2" />
                  <th className="px-2 py-2">{t("bill.col.item")}</th>
                  <th className="px-2 py-2">{t("bill.col.category")}</th>
                  <th className="px-2 py-2">{t("bill.col.qty")}</th>
                  <th className="px-2 py-2">{t("bill.col.cost")}</th>
                  <th className="px-2 py-2">{t("bill.col.price")}</th>
                  <th className="px-2 py-2">{t("bill.col.expires")}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className={`border-t border-stone-100 ${l.include ? "" : "opacity-40"}`}>
                    <td className="px-3 py-1.5">
                      <input type="checkbox" aria-label={`Include ${l.name}`} checked={l.include} onChange={(e) => update(i, { include: e.target.checked })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input className={cell} value={l.name} onChange={(e) => update(i, { name: e.target.value })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <select className={cell} value={l.category} onChange={(e) => update(i, { category: e.target.value as Line["category"] })}>
                        {CATEGORIES.map((c) => <option key={c} value={c}>{category(c)}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex gap-1">
                        <input className={`${cell} w-16`} inputMode="decimal" value={l.quantity} onChange={(e) => update(i, { quantity: num(e.target.value) })} />
                        <select className={`${cell} w-16`} value={l.unit} onChange={(e) => update(i, { unit: e.target.value as Line["unit"] })}>
                          {UNITS.map((u) => <option key={u} value={u}>{unit(u)}</option>)}
                        </select>
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <input className={`${cell} w-20`} inputMode="decimal" value={l.unitCost} onChange={(e) => update(i, { unitCost: num(e.target.value) })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input className={`${cell} w-20`} inputMode="decimal" value={l.unitPrice} onChange={(e) => update(i, { unitPrice: num(e.target.value) })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="date" className={cell} value={l.expiresOn} onChange={(e) => update(i, { expiresOn: e.target.value })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-sm text-stone-500">
              {t("bill.selected", { n: chosen.length })} · {t("common.atCost", { amount: rupees(chosen.reduce((s, l) => s + l.quantity * l.unitCost, 0)) })}
            </span>
            <button onClick={() => setLines([])} className="ml-auto rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm hover:bg-stone-50">
              {t("bill.discard")}
            </button>
            <button
              onClick={addAll}
              disabled={!chosen.length || status === "saving"}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {status === "saving" ? t("add.adding") : t("bill.add", { n: chosen.length })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
