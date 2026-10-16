"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { notYetLive, type BundleSuggestion } from "@/lib/bundles";
import { useT } from "@/lib/i18n";
import { rupees, type Bundle } from "@/lib/schema";

type LiveBundle = Bundle & { available: number; held: number };
type Reservation = { id: string; bundleTitle: string; price: number; customerName: string; code: string; expiresAt: string; expired: boolean };

/** Customer pre-orders waiting at the counter. Matching the 4-digit code confirms it's the right person. */
function Reservations({ list, onChange }: { list: Reservation[]; onChange: () => void }) {
  const { t, time } = useT();
  const [error, setError] = useState("");
  if (!list.length) return null;
  const act = (id: string, action: "collect" | "cancel") =>
    api(`/api/reservations/${id}/${action}`, { method: "POST" }).then(
      () => {
        setError("");
        onChange();
      },
      (err) => setError(err.message),
    );
  return (
    <section className="mt-6">
      <h2 className="font-semibold">{t("bundles.reservations")}</h2>
      <p className="text-sm text-stone-500">{t("bundles.reservationsHint")}</p>
      <ul className="mt-3 divide-y divide-stone-200 rounded-2xl border border-emerald-200 bg-emerald-50/40">
        {list.map((r) => (
          <li key={r.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${r.expired ? "opacity-60" : ""}`}>
            <div className="w-16 text-2xl font-bold tracking-widest tabular-nums">{r.code}</div>
            <div className="min-w-40 flex-1">
              <div className="font-medium">{r.customerName}</div>
              <div className="text-xs text-stone-500">
                {r.bundleTitle} · {rupees(r.price)} · {r.expired ? t("bundles.holdEnded", { time: time(r.expiresAt) }) : t("bundles.pickUpBy", { time: time(r.expiresAt) })}
              </div>
            </div>
            <button onClick={() => act(r.id, "collect")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">
              {t("bundles.pickedUp")}
            </button>
            <button onClick={() => act(r.id, "cancel")} className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50">
              {r.expired ? t("bundles.clear") : t("common.cancel")}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}

const itemsText = (items: { name: string; quantity: number; unit: string }[], unit: (u: string) => string) =>
  items.map((i) => `${i.quantity} ${unit(i.unit)} ${i.name}`).join(" + ");

function SuggestionCard({ s, onPublished }: { s: BundleSuggestion; onPublished: () => void }) {
  const { t, unit, when } = useT();
  const [price, setPrice] = useState(String(s.price));
  const [title, setTitle] = useState(s.title);
  const [description, setDescription] = useState(s.description);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [writing, setWriting] = useState(false);
  const p = Number(price);
  const off = p > 0 ? Math.round((1 - p / s.originalPrice) * 100) : 0;
  const items = s.items.map((i) => ({ batchId: i.batchId, quantity: i.quantity }));

  async function writeWithAi() {
    setWriting(true);
    setError("");
    try {
      const copy = await api<{ title: string; description: string }>("/api/bundles/copy", {
        method: "POST",
        body: JSON.stringify({ items, price: p > 0 ? p : s.price }),
      });
      setTitle(copy.title);
      setDescription(copy.description);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setWriting(false);
    }
  }

  async function publish() {
    setBusy(true);
    setError("");
    try {
      await api("/api/bundles", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim() || s.title,
          // Keep the template's "% off" in step with an edited price.
          description: description.replace(/at \d+% off/, `at ${off}% off`).trim(),
          items,
          price: p,
        }),
      });
      onPublished();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col rounded-2xl border border-stone-200 bg-white p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-orange-600">{t("bundles.expires", { when: when(s.expiresOn) })}</div>
      <input
        aria-label={t("bundles.nameLabel")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="-mx-1 mt-1 rounded px-1 font-semibold hover:bg-stone-50 focus:bg-stone-50 focus:outline-none"
      />
      <p className="mt-1 text-sm text-stone-500">{itemsText(s.items, unit)}</p>
      <textarea
        aria-label={t("bundles.descLabel")}
        rows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="mt-2 resize-none rounded-lg border border-stone-200 px-2 py-1.5 text-sm text-stone-700 focus:border-emerald-500 focus:outline-none"
      />
      <button
        type="button"
        onClick={writeWithAi}
        disabled={writing}
        className="mt-1.5 self-start text-xs font-medium text-violet-700 hover:underline disabled:opacity-50"
      >
        {writing ? t("bundles.writing") : t("bundles.writeAi")}
      </button>
      <div className="mt-4 flex items-end gap-3">
        <div>
          <div className="text-xs text-stone-500 line-through">{rupees(s.originalPrice)}</div>
          <label className="flex items-center gap-1 text-lg font-semibold">
            ₹
            <input
              aria-label={t("bundles.priceLabel")}
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-20 rounded-lg border border-stone-300 px-2 py-1"
            />
          </label>
        </div>
        <div className="pb-1.5 text-sm text-emerald-700">{off > 0 ? t("bundles.off", { n: off }) : ""}</div>
        <div className="ml-auto pb-1.5 text-xs text-stone-500">{t("bundles.enoughFor", { n: s.available })}</div>
      </div>
      <button
        onClick={publish}
        disabled={busy || !(p > 0) || p > s.originalPrice}
        className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? t("bundles.publishing") : t("bundles.publish")}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function LiveBundleRow({ b, onChange }: { b: LiveBundle; onChange: () => void }) {
  const { t, unit, when } = useT();
  const [error, setError] = useState("");
  const act = (url: string, method: string) => api(url, { method }).then(onChange, (err) => setError(err.message));

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-48 flex-1">
        <div className="font-medium">{b.title}</div>
        <div className="text-xs text-stone-500">
          {itemsText(b.items, unit)} · {t("bundles.until", { when: when(b.expiresOn) })}
        </div>
      </div>
      <div className="text-right">
        <div className="font-semibold">
          {rupees(b.price)} <span className="text-xs font-normal text-stone-400 line-through">{rupees(b.originalPrice)}</span>
        </div>
        <div className="text-xs text-stone-500">
          {t("bundles.stats", { sold: b.soldCount, left: b.available })}
          {b.held ? t("bundles.reserved", { n: b.held }) : ""}
        </div>
      </div>
      <button
        onClick={() => act(`/api/bundles/${b.id}/sell`, "POST")}
        disabled={b.available < 1}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {t("bundles.sold1")}
      </button>
      <button onClick={() => act(`/api/bundles/${b.id}`, "DELETE")} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50">
        {t("bundles.takeDown")}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </li>
  );
}

export default function BundlesPage() {
  const { t } = useT();
  const [suggestions, setSuggestions] = useState<BundleSuggestion[] | null>(null);
  const [live, setLive] = useState<LiveBundle[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  const load = useCallback(() => {
    api<LiveBundle[]>("/api/bundles").then(setLive, () => setLive([]));
    api<Reservation[]>("/api/reservations").then(setReservations, () => setReservations([]));
    api<BundleSuggestion[]>("/api/bundles/suggestions").then(setSuggestions, () => setSuggestions([]));
  }, []);
  useEffect(() => {
    load();
    // New customer reservations show up without reloading.
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  // The API already leaves out suggestions that are on sale; this also hides one the moment it's published.
  const fresh = suggestions && notYetLive(suggestions, live);
  const key = (items: { batchId: string }[]) => items.map((i) => i.batchId).join();

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("bundles.title")}</h1>
      <p className="text-sm text-stone-500">{t("bundles.subtitle")}</p>

      <Reservations list={reservations} onChange={load} />

      <section className="mt-6">
        <h2 className="font-semibold">{t("bundles.onSale")}</h2>
        {live.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">{t("bundles.nothingOnSale")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white">
            {live.map((b) => <LiveBundleRow key={b.id} b={b} onChange={load} />)}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">{t("bundles.suggested")}</h2>
        <p className="text-sm text-stone-500">{t("bundles.suggestedHint")}</p>
        {fresh === null && <p className="mt-6 text-stone-500">{t("bundles.finding")}</p>}
        {fresh?.length === 0 && (
          <p className="mt-4 rounded-2xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
            {t("bundles.nothingToRescue")} <Link href="/stock" className="text-emerald-700 underline">{t("bundles.checkStock")}</Link>
          </p>
        )}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fresh?.map((s) => <SuggestionCard key={key(s.items)} s={s} onPublished={load} />)}
        </div>
      </section>
    </div>
  );
}
