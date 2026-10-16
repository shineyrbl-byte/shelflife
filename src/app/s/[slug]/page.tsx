"use client";

import { Suspense, useEffect, useState } from "react";
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
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const load = () =>
      fetch(`/api/public/${encodeURIComponent(slug)}/deals`)
        .then(async (res) => {
          if (res.status === 404) return setMissing(true);
          const data = await res.json();
          setShopName(data.shop.name);
          setShareUrl(data.shop.publicUrl);
          setDeals(data.deals);
        })
        .catch(() => setDeals((d) => d ?? []));
    load();
    // Keep counts current while the page is open on a counter screen.
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [slug]);

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
        These are fresh items close to their best-before date, bundled at a discount so nothing goes in the bin. Show this page at the counter.
      </p>

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
          </li>
        ))}
      </ul>

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
