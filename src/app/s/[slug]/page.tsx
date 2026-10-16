"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { expiryLabel, rupees } from "@/lib/schema";

type Deal = {
  id: string;
  title: string;
  description: string;
  items: { name: string; quantity: number; unit: string }[];
  originalPrice: number;
  price: number;
  expiresOn: string;
  available: number;
};

type MyReservation = { id: string; code: string; expiresAt: string; title: string; price: number };

// A customer's own reservations live in their browser only, so the page can show their pickup codes again.
const storageKey = (slug: string) => `sl-reservations:${slug}`;
function loadMine(slug: string): MyReservation[] {
  try {
    const all: MyReservation[] = JSON.parse(localStorage.getItem(storageKey(slug)) ?? "[]");
    return all.filter((r) => r.expiresAt > new Date().toISOString());
  } catch {
    return [];
  }
}
const saveMine = (slug: string, list: MyReservation[]) => localStorage.setItem(storageKey(slug), JSON.stringify(list));
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

function ReserveForm({ slug, deal, onReserved }: { slug: string; deal: Deal; onReserved: (r: MyReservation) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function reserve(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch(`/api/public/${encodeURIComponent(slug)}/reserve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bundleId: deal.id, name }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Couldn't reserve. Please try again.");
    setOpen(false);
    onReserved(data);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700">
        Reserve for pickup
      </button>
    );
  }
  return (
    <form onSubmit={reserve} className="mt-4 rounded-xl bg-stone-50 p-3">
      <label className="block text-sm text-stone-600">
        Your first name (so the shop knows it&apos;s you)
        <input
          autoFocus
          required
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-emerald-500 focus:outline-none"
        />
      </label>
      <p className="mt-2 text-xs text-stone-500">We&apos;ll hold it for 1 hour. Pay at the counter when you pick it up.</p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button disabled={busy} className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {busy ? "Reserving…" : `Reserve for ${rupees(deal.price)}`}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}

/** How customers follow the shop: ntfy in the browser or the free ntfy app, no account needed. */
function DealAlerts({ alerts, shopName }: { alerts: { topic: string; url: string }; shopName: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-6 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 font-medium text-stone-800 hover:bg-stone-50">
        🔔 Get deal alerts
      </button>
    );
  }
  return (
    <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-600">
      <div className="font-semibold text-stone-900">🔔 Get a notification when {shopName || "this shop"} posts a new deal</div>
      <p className="mt-2">Free, no account needed, and you can turn it off any time.</p>
      <ol className="mt-3 list-decimal space-y-2 pl-5">
        <li>
          <b>On this phone or computer:</b>{" "}
          <a href={alerts.url} target="_blank" rel="noreferrer" className="text-emerald-700 underline">
            open the alerts page
          </a>{" "}
          and tap <b>Subscribe</b>, then allow notifications.
        </li>
        <li>
          <b>Or with the ntfy app</b> (App Store / Play Store): tap <b>+</b> and subscribe to{" "}
          <button
            onClick={() => {
              navigator.clipboard.writeText(alerts.topic);
              setCopied(true);
            }}
            className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs text-stone-800"
            title="Copy"
          >
            {alerts.topic}
          </button>
          {copied && <span className="ml-1 text-emerald-700">copied ✓</span>}
        </li>
      </ol>
    </div>
  );
}

function whatsappText(shopName: string, deals: Deal[], url: string) {
  const lines = deals.map((d) => `• ${d.title}: ${rupees(d.price)} (was ${rupees(d.originalPrice)}), until ${expiryLabel(d.expiresOn)}`);
  return `Today's rescue deals at ${shopName} 🥐☕\n\n${lines.join("\n")}\n\nFresh food, lower prices, less waste. Limited stock:\n${url}`;
}

/** Public page for customers: one shop's rescue bundles today, readable on a phone. */
function Deals() {
  const { slug } = useParams<{ slug: string }>();
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [shopName, setShopName] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [kgRescued, setKgRescued] = useState(0);
  const [alerts, setAlerts] = useState<{ topic: string; url: string } | null>(null);
  const [missing, setMissing] = useState(false);
  const [mine, setMine] = useState<MyReservation[]>([]);

  const load = useCallback(
    () =>
      fetch(`/api/public/${encodeURIComponent(slug)}/deals`)
        .then(async (res) => {
          if (res.status === 404) return setMissing(true);
          const data = await res.json();
          setMine(loadMine(slug));
          setShopName(data.shop.name);
          setShareUrl(data.shop.publicUrl);
          setKgRescued(data.shop.kgRescued ?? 0);
          setAlerts(data.shop.alerts ?? null);
          setDeals(data.deals);
        })
        .catch(() => setDeals((d) => d ?? [])),
    [slug],
  );

  useEffect(() => {
    load();
    // Keep counts current while the page is open on a counter screen.
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  function reserved(r: MyReservation) {
    const list = [...loadMine(slug), r];
    saveMine(slug, list);
    setMine(list);
    load();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function cancelMine(r: MyReservation) {
    await fetch(`/api/public/${encodeURIComponent(slug)}/reservations/${r.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: r.code }),
    });
    const list = loadMine(slug).filter((x) => x.id !== r.id);
    saveMine(slug, list);
    setMine(list);
    load();
  }

  if (missing) {
    return <p className="mx-auto max-w-xl px-5 py-24 text-center text-stone-500">This shop link doesn&apos;t exist. Check the QR code or ask the shop.</p>;
  }

  const share = () => {
    if (!deals?.length) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(whatsappText(shopName, deals, shareUrl || window.location.href))}`, "_blank");
  };

  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny static icon */}
        <img src="/icon-192.png" alt="" className="h-6 w-6 rounded-md" />
        Rescue deals{shopName ? ` at ${shopName}` : ""}
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Good food, less waste</h1>
      <p className="mt-2 text-stone-600">
        These are fresh items close to their best-before date, bundled at a discount so nothing goes in the bin. Reserve one and pick it up within the hour, or just show this page at the counter.
      </p>

      {kgRescued >= 1 && (
        <p className="mt-3 text-sm font-medium text-emerald-800">
          🌱 Thanks to customers like you, {shopName} has rescued about {Math.round(kgRescued)} kg of food so far.
        </p>
      )}

      {mine.length > 0 && (
        <section className="mt-6 space-y-3">
          {mine.map((r) => (
            <div key={r.id} className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-5">
              <div className="text-sm font-medium text-emerald-800">Reserved for you ✓</div>
              <div className="mt-1 font-semibold">{r.title}</div>
              <div className="mt-3 flex items-end gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-stone-500">Pickup code</div>
                  <div className="text-4xl font-bold tracking-widest tabular-nums">{r.code}</div>
                </div>
                <div className="pb-1 text-sm text-stone-600">
                  Pick up by <b>{timeLabel(r.expiresAt)}</b>
                  <br />
                  Pay {rupees(r.price)} at the counter
                </div>
              </div>
              <button onClick={() => cancelMine(r)} className="mt-3 text-xs text-stone-500 underline">
                I can&apos;t make it, cancel
              </button>
            </div>
          ))}
        </section>
      )}

      {deals === null && <p className="mt-10 text-center text-stone-500">Loading today&apos;s deals…</p>}
      {deals?.length === 0 && (
        <p className="mt-8 rounded-2xl border border-dashed border-stone-300 p-8 text-center text-stone-500">
          No deals right now. Check back later today!
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {deals?.map((d) => (
          <li key={d.id} className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h2 className="font-semibold">{d.title}</h2>
                {d.description && <p className="mt-1 text-sm text-stone-700">{d.description}</p>}
                <p className="mt-1 text-xs text-stone-500">{d.items.map((i) => `${i.quantity} ${i.unit} ${i.name}`).join(" + ")}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold">{rupees(d.price)}</div>
                <div className="text-sm text-stone-400 line-through">{rupees(d.originalPrice)}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                {Math.round((1 - d.price / d.originalPrice) * 100)}% off
              </span>
              <span className="text-stone-500">Until {expiryLabel(d.expiresOn)}</span>
              <span className={`ml-auto ${d.available <= 2 ? "font-medium text-orange-600" : "text-stone-500"}`}>
                {d.available <= 2 ? `Only ${d.available} left` : `${d.available} left`}
              </span>
            </div>
            <ReserveForm slug={slug} deal={d} onReserved={reserved} />
          </li>
        ))}
      </ul>

      {alerts && deals !== null && <DealAlerts alerts={alerts} shopName={shopName} />}

      {!!deals?.length && (
        <button onClick={share} className="mt-6 w-full rounded-xl bg-[#25D366] px-4 py-3 font-medium text-white hover:brightness-95">
          Share on WhatsApp
        </button>
      )}
    </div>
  );
}

export default function DealsPage() {
  return (
    <Suspense fallback={<p className="py-24 text-center text-stone-500">Loading…</p>}>
      <Deals />
    </Suspense>
  );
}
