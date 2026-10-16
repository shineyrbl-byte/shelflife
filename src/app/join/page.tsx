"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

/** Where an invited staff member sets up their own login, from the owner's invite link. */
function Join() {
  const token = useSearchParams().get("token") ?? "";
  const [shopName, setShopName] = useState<string | null>(null);
  const [invalid, setInvalid] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/auth/invite?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) setShopName(data.shop.name);
        else setInvalid(data.error ?? "This invite link isn't valid.");
      })
      .catch(() => setInvalid("Couldn't check the invite. Please try again."));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, ...form }) });
    if (res.ok) {
      window.location.replace("/stock");
      return;
    }
    setError((await res.json().catch(() => ({}))).error ?? "Something went wrong. Please try again.");
    setBusy(false);
  }

  const input = "mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-emerald-500 focus:outline-none";
  return (
    <div className="mx-auto w-full max-w-sm px-5 py-16">
      <div className="flex items-center gap-2 font-semibold">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny static icon */}
        <img src="/icon-192.png" alt="" className="h-8 w-8 rounded-lg" />
        ShelfLife
      </div>
      {invalid ? (
        <p className="mt-8 text-stone-600">{invalid}</p>
      ) : !shopName ? (
        <p className="mt-8 text-stone-500">Checking your invite…</p>
      ) : (
        <>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Join {shopName}</h1>
          <p className="mt-1 text-sm text-stone-500">Set up your own login to add stock and sell rescue bundles.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm text-stone-600">
              Your name
              <input className={input} required maxLength={40} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="block text-sm text-stone-600">
              Email
              <input className={input} type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="block text-sm text-stone-600">
              Password
              <input
                className={input}
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <span className="text-xs text-stone-400">At least 8 characters</span>
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={busy} className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              {busy ? "Please wait…" : `Join ${shopName}`}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense>
      <Join />
    </Suspense>
  );
}
