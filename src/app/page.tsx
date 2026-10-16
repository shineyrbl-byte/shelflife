import type { Metadata } from "next";
import Link from "next/link";
import LiveCounter from "./LiveCounter";

export const metadata: Metadata = {
  title: "ShelfLife: sell it before it expires",
  description:
    "Free expiry tracking for small cafés and grocers. See what's about to expire, sell it as discounted rescue bundles, and waste less every week.",
};

const STEPS = [
  {
    icon: "📷",
    title: "Add stock in seconds",
    text: "Snap a photo of the supplier bill and AI fills in every item, or scan barcodes. Each batch gets its expiry date.",
  },
  {
    icon: "⏳",
    title: "See what's about to expire",
    text: "Stock is sorted by urgency, and a morning summary on your phone tells you what expires today and tomorrow.",
  },
  {
    icon: "🛍️",
    title: "Sell it as rescue bundles",
    text: "ShelfLife pairs near-expiry items (croissant + coffee) and prices them to sell, never below cost. Customers reserve and pick up.",
  },
];

const FEATURES = [
  ["🧾", "Bill scanning", "Photo of a delivery bill → stock lines, with names cleaned up and units converted."],
  ["🔖", "Barcodes", "Scan packaged goods with the phone camera or a USB scanner; it remembers your items."],
  ["🤝", "Smart bundles", "Pairs what people buy together and discounts by urgency: 50% today, 40% tomorrow."],
  ["📱", "Customer deals page", "Your own link and QR poster. Customers see today's deals and reserve with a pickup code."],
  ["📊", "Ordering tips", "“Bake 9 croissants, not 12”: learns from what you actually sold and binned."],
  ["🌱", "Impact", "Food rescued, CO₂ avoided and money recovered, ready to share with customers."],
];

/** A small, static picture of the customer deals page for the hero. */
function PhoneMock() {
  return (
    <div className="mx-auto w-64 rounded-[2rem] border-8 border-stone-900 bg-stone-50 p-3 shadow-2xl shadow-emerald-900/20">
      <div className="text-[10px] font-medium text-emerald-700">Rescue deals at Café Mogra</div>
      <div className="mt-0.5 text-sm font-semibold">Good food, less waste</div>
      {[
        ["Breakfast rescue", "Croissant + Cold coffee", "₹90", "₹180", "Only 2 left"],
        ["Lunch combo", "Paneer wrap + Orange juice", "₹120", "₹240", "4 left"],
      ].map(([title, items, price, was, left]) => (
        <div key={title} className="mt-2 rounded-xl border border-stone-200 bg-white p-2.5">
          <div className="flex justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold">{title}</div>
              <div className="text-[9px] text-stone-500">{items}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold">{price}</div>
              <div className="text-[9px] text-stone-400 line-through">{was}</div>
            </div>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[9px]">
            <span className="rounded-full bg-emerald-50 px-1.5 font-medium text-emerald-700">50% off</span>
            <span className="text-orange-600">{left}</span>
          </div>
          <div className="mt-1.5 rounded-md bg-emerald-600 py-1 text-center text-[9px] font-medium text-white">Reserve for pickup</div>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="bg-gradient-to-b from-emerald-50/70 via-stone-50 to-stone-50">
      <header className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-4 text-sm">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny static icon */}
          <img src="/icon-192.png" alt="" className="h-7 w-7 rounded-lg" />
          ShelfLife
        </Link>
        <Link href="/login" className="ml-auto text-stone-600 hover:text-stone-900">
          Log in
        </Link>
        <Link href="/signup" className="rounded-lg bg-emerald-600 px-3.5 py-1.5 font-medium text-white hover:bg-emerald-700">
          Set up your shop
        </Link>
      </header>

      <main>
        <section className="mx-auto grid max-w-5xl items-center gap-12 px-5 pb-8 pt-10 md:grid-cols-[1.2fr_1fr] md:pt-16">
          <div>
            <p className="text-sm font-medium text-emerald-700">For small cafés, bakeries and grocers</p>
            <h1 className="mt-2 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">Sell it before it expires.</h1>
            <p className="mt-4 text-lg text-stone-600">
              ShelfLife tracks every batch&apos;s expiry date, tells you what&apos;s at risk each morning, and turns near-expiry food into
              discounted <b>rescue bundles</b> your customers can reserve. Less in the bin, more in the till.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/signup" className="rounded-xl bg-emerald-600 px-5 py-3 font-medium text-white hover:bg-emerald-700">
                Set up your shop, free
              </Link>
              <a href="#how" className="rounded-xl border border-stone-300 bg-white px-5 py-3 font-medium text-stone-700 hover:bg-stone-50">
                How it works
              </a>
            </div>
            <p className="mt-3 text-sm text-stone-500">Works on any phone or laptop. No card, no installation.</p>
          </div>
          <PhoneMock />
        </section>

        <LiveCounter />

        <section id="how" className="mx-auto max-w-5xl scroll-mt-8 px-5 py-20">
          <h2 className="text-center text-3xl font-semibold tracking-tight">How it works</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-2xl border border-stone-200 bg-white p-6">
                <div className="text-3xl">{s.icon}</div>
                <div className="mt-3 text-xs font-medium uppercase tracking-wide text-emerald-700">Step {i + 1}</div>
                <h3 className="mt-1 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-stone-600">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-stone-200 bg-white py-20">
          <div className="mx-auto max-w-5xl px-5">
            <h2 className="text-center text-3xl font-semibold tracking-tight">Everything a small shop needs</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-stone-600">Built for busy counters: big buttons, phone-first, and nothing to set up.</p>
            <div className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(([icon, title, text]) => (
                <div key={title} className="flex gap-3">
                  <div className="text-2xl">{icon}</div>
                  <div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-1 text-sm text-stone-600">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 py-20 text-center">
          <h2 className="text-3xl font-semibold tracking-tight">Every croissant you sell is one you don&apos;t throw away.</h2>
          <p className="mt-4 text-stone-600">
            Set up your shop in a minute, add today&apos;s stock, and publish your first rescue bundle before closing time.
          </p>
          <Link href="/signup" className="mt-7 inline-block rounded-xl bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700">
            Set up your shop, free
          </Link>
        </section>
      </main>

      <footer className="border-t border-stone-200 py-8 text-center text-sm text-stone-500">
        ShelfLife · Made in Goa ·{" "}
        <a href="https://github.com/shineyrbl-byte/shelflife" className="underline hover:text-stone-800">
          Open source on GitHub
        </a>
      </footer>
    </div>
  );
}
