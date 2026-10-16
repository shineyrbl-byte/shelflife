"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type ShopSettings = { name: string; slug: string; ntfyTopic: string | null; publicUrl: string };

/** A hard-to-guess topic, e.g. "shelflife-cafe-mogra-k3x9q2p7". */
const randomTopic = (slug: string) => `shelflife-${slug.slice(0, 24)}-${Math.random().toString(36).slice(2, 10)}`;

export default function SettingsPage() {
  const [shop, setShop] = useState<ShopSettings | null>(null);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api<ShopSettings>("/api/shop").then((s) => {
      setShop(s);
      setName(s.name);
      setTopic(s.ntfyTopic ?? "");
    });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    try {
      const s = await api<ShopSettings>("/api/shop", { method: "PATCH", body: JSON.stringify({ name, ntfyTopic: topic }) });
      setShop(s);
      setStatus({ ok: true, text: "Saved." });
    } catch (err) {
      setStatus({ ok: false, text: (err as Error).message });
    }
  }

  if (!shop) return <p className="py-24 text-center text-stone-500">Loading…</p>;
  const { publicUrl } = shop;
  const input = "mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none";

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-semibold">Your customer deals page</h2>
        <p className="text-sm text-stone-500">Share this link or print the QR poster. It stays the same even if you rename the shop.</p>
        <div className="mt-3 flex gap-2">
          <input readOnly value={publicUrl} className={`${input} mt-0 bg-stone-50`} />
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(publicUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="shrink-0 rounded-lg border border-stone-300 px-3 text-sm hover:bg-stone-50"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
      </section>

      <form onSubmit={save} className="mt-6 space-y-6 rounded-2xl border border-stone-200 bg-white p-5">
        <label className="block text-sm text-stone-600">
          Shop name
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
          <span className="text-xs text-stone-400">Shown to customers, on the poster and in summaries.</span>
        </label>

        <div>
          <div className="text-sm font-medium text-stone-800">Morning summary on your phone</div>
          <p className="mt-1 text-sm text-stone-500">
            Every day at about 8:00 a.m., get what expires today and tomorrow and how many bundles are ready, as a phone notification.
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-stone-600">
            <li>Install the free <b>ntfy</b> app (App Store / Play Store). No account needed.</li>
            <li>
              Pick a topic name below{" "}
              <button type="button" onClick={() => setTopic(randomTopic(shop.slug))} className="text-emerald-700 underline">
                or make one for me
              </button>
              , then save.
            </li>
            <li>In the ntfy app, tap <b>+</b> and subscribe to the same topic name.</li>
          </ol>
          <label className="mt-3 block text-sm text-stone-600">
            ntfy topic
            <input className={input} placeholder="leave empty to turn off" value={topic} onChange={(e) => setTopic(e.target.value)} />
            <span className="text-xs text-stone-400">Anyone who knows this name can read your summaries, so keep it hard to guess.</span>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">Save</button>
          {status && <span className={`text-sm ${status.ok ? "text-emerald-700" : "text-red-600"}`}>{status.text}</span>}
        </div>
      </form>
    </div>
  );
}
