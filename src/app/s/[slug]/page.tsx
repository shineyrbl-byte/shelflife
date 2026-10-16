"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LanguageSwitch, useT } from "@/lib/i18n";
import { rupees } from "@/lib/schema";
import { upiNote, upiPayUrl } from "@/lib/upi";

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

type MyReservation = { id: string; code: string; expiresAt: string; title: string; price: number; paid?: boolean };

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

function ReserveForm({ slug, deal, onReserved }: { slug: string; deal: Deal; onReserved: (r: MyReservation) => void }) {
  const { t } = useT();
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
    if (!res.ok) return setError(data.error ?? t("deals.reserveFailed"));
    setOpen(false);
    onReserved(data);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700">
        {t("deals.reserve")}
      </button>
    );
  }
  return (
    <form onSubmit={reserve} className="mt-4 rounded-xl bg-stone-50 p-3">
      <label className="block text-sm text-stone-600">
        {t("deals.yourName")}
        <input
          autoFocus
          required
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-emerald-500 focus:outline-none"
        />
      </label>
      <p className="mt-2 text-xs text-stone-500">{t("deals.holdNote")}</p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button disabled={busy} className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {busy ? t("deals.reserving") : t("deals.reserveFor", { price: rupees(deal.price) })}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm">
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

/** Optional UPI pre-payment for a reservation: opens a UPI app (or shows a QR on a computer), then "I've paid". */
function PayByUpi({ r, upiId, shopName, onPaid }: { r: MyReservation; upiId: string; shopName: string; onPaid: () => void }) {
  const { t } = useT();
  const [qr, setQr] = useState("");
  const url = upiPayUrl({ upiId, payeeName: shopName, amount: r.price, note: upiNote(r.code) });

  async function toggleQr() {
    if (qr) return setQr("");
    const QRCode = (await import("qrcode")).default;
    setQr(await QRCode.toString(url, { type: "svg", margin: 1 }));
  }

  return (
    <div className="mt-4 rounded-xl bg-white p-3">
      <a href={url} className="block rounded-lg bg-stone-900 px-4 py-2.5 text-center text-sm font-medium text-white">
        {t("deals.payUpi", { price: rupees(r.price) })}
      </a>
      <p className="mt-1.5 text-xs text-stone-500">{t("deals.payUpiHint")}</p>
      <button onClick={toggleQr} className="mt-1 text-xs text-stone-500 underline">
        {qr ? t("deals.hideQr") : t("deals.showQr")}
      </button>
      {/* The SVG comes from the qrcode library, not from user content. */}
      {qr && <div className="mx-auto mt-2 w-44" dangerouslySetInnerHTML={{ __html: qr }} />}
      <button onClick={onPaid} className="mt-3 w-full rounded-lg border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700">
        {t("deals.paidButton")}
      </button>
    </div>
  );
}

/** How customers follow the shop: ntfy in the browser or the free ntfy app, no account needed. */
function DealAlerts({ alerts, shopName }: { alerts: { topic: string; url: string }; shopName: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-6 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 font-medium text-stone-800 hover:bg-stone-50">
        {t("deals.alerts")}
      </button>
    );
  }
  return (
    <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-600">
      <div className="font-semibold text-stone-900">{t("deals.alertsTitle", { shop: shopName || t("deals.thisShop") })}</div>
      <p className="mt-2">{t("deals.alertsFree")}</p>
      <ol className="mt-3 list-decimal space-y-2 pl-5">
        <li>
          <b>{t("deals.alertsBrowser")}</b>{" "}
          <a href={alerts.url} target="_blank" rel="noreferrer" className="text-emerald-700 underline">
            {t("deals.alertsOpen")}
          </a>{" "}
          {t("deals.alertsBrowserRest")}
        </li>
        <li>
          {t("deals.alertsApp")}{" "}
          <button
            onClick={() => {
              navigator.clipboard.writeText(alerts.topic);
              setCopied(true);
            }}
            className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs text-stone-800"
            title={t("deals.copy")}
          >
            {alerts.topic}
          </button>
          {copied && <span className="ml-1 text-emerald-700">{t("deals.copied")}</span>}
        </li>
      </ol>
    </div>
  );
}

/** Public page for customers: one shop's rescue bundles today, readable on a phone. */
function Deals() {
  const { slug } = useParams<{ slug: string }>();
  const { t, unit, when, time } = useT();
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [shopName, setShopName] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [kgRescued, setKgRescued] = useState(0);
  const [alerts, setAlerts] = useState<{ topic: string; url: string } | null>(null);
  const [upiId, setUpiId] = useState<string | null>(null);
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
          setUpiId(data.shop.upiId ?? null);
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

  async function paid(r: MyReservation) {
    const res = await fetch(`/api/public/${encodeURIComponent(slug)}/reservations/${r.id}/paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: r.code }),
    });
    if (!res.ok) return;
    const list = loadMine(slug).map((x) => (x.id === r.id ? { ...x, paid: true } : x));
    saveMine(slug, list);
    setMine(list);
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
    return <p className="mx-auto max-w-xl px-5 py-24 text-center text-stone-500">{t("deals.missing")}</p>;
  }

  const share = () => {
    if (!deals?.length) return;
    const lines = deals.map((d) => t("deals.shareLine", { title: d.title, price: rupees(d.price), was: rupees(d.originalPrice), when: when(d.expiresOn) }));
    const text = t("deals.shareText", { shop: shopName, lines: lines.join("\n"), url: shareUrl || window.location.href });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny static icon */}
        <img src="/icon-192.png" alt="" className="h-6 w-6 rounded-md" />
        {shopName ? t("deals.kickerAt", { shop: shopName }) : t("deals.kicker")}
        <LanguageSwitch className="ml-auto" />
      </div>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("deals.title")}</h1>
      <p className="mt-2 text-stone-600">{t("deals.intro")}</p>

      {kgRescued >= 1 && (
        <p className="mt-3 text-sm font-medium text-emerald-800">
          {t("deals.rescuedSoFar", { shop: shopName, kg: Math.round(kgRescued) })}
        </p>
      )}

      {mine.length > 0 && (
        <section className="mt-6 space-y-3">
          {mine.map((r) => (
            <div key={r.id} className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-5">
              <div className="text-sm font-medium text-emerald-800">{t("deals.reserved")}</div>
              <div className="mt-1 font-semibold">{r.title}</div>
              <div className="mt-3 flex items-end gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-stone-500">{t("deals.pickupCode")}</div>
                  <div className="text-4xl font-bold tracking-widest tabular-nums">{r.code}</div>
                </div>
                <div className="pb-1 text-sm text-stone-600">
                  <b>{t("deals.pickUpBy", { time: time(r.expiresAt) })}</b>
                  <br />
                  {r.paid ? t("deals.paidDone") : t("deals.payAtCounter", { price: rupees(r.price) })}
                </div>
              </div>
              {upiId && !r.paid && <PayByUpi r={r} upiId={upiId} shopName={shopName} onPaid={() => paid(r)} />}
              {r.paid ? (
                <p className="mt-3 text-xs text-stone-500">{t("deals.paidCantCancel")}</p>
              ) : (
                <button onClick={() => cancelMine(r)} className="mt-3 text-xs text-stone-500 underline">
                  {t("deals.cantMakeIt")}
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      {deals === null && <p className="mt-10 text-center text-stone-500">{t("deals.loading")}</p>}
      {deals?.length === 0 && (
        <p className="mt-8 rounded-2xl border border-dashed border-stone-300 p-8 text-center text-stone-500">
          {t("deals.none")}
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {deals?.map((d) => (
          <li key={d.id} className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h2 className="font-semibold">{d.title}</h2>
                {d.description && <p className="mt-1 text-sm text-stone-700">{d.description}</p>}
                <p className="mt-1 text-xs text-stone-500">{d.items.map((i) => `${i.quantity} ${unit(i.unit)} ${i.name}`).join(" + ")}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold">{rupees(d.price)}</div>
                <div className="text-sm text-stone-400 line-through">{rupees(d.originalPrice)}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                {t("deals.off", { n: Math.round((1 - d.price / d.originalPrice) * 100) })}
              </span>
              <span className="text-stone-500">{t("deals.until", { when: when(d.expiresOn) })}</span>
              <span className={`ml-auto ${d.available <= 2 ? "font-medium text-orange-600" : "text-stone-500"}`}>
                {d.available <= 2 ? t("deals.onlyLeft", { n: d.available }) : t("deals.left", { n: d.available })}
              </span>
            </div>
            <ReserveForm slug={slug} deal={d} onReserved={reserved} />
          </li>
        ))}
      </ul>

      {alerts && deals !== null && <DealAlerts alerts={alerts} shopName={shopName} />}

      {!!deals?.length && (
        <button onClick={share} className="mt-6 w-full rounded-xl bg-[#25D366] px-4 py-3 font-medium text-white hover:brightness-95">
          {t("deals.share")}
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
