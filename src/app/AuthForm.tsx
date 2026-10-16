"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Mode = "login" | "signup";

function Form({ mode }: { mode: Mode }) {
  const next = useSearchParams().get("next");
  const [form, setForm] = useState({ shopName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = mode === "signup" ? form : { email: form.email, password: form.password };
    const res = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      // Only follow same-site paths, never a full URL from the query string.
      window.location.href = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
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
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">{mode === "signup" ? "Set up your shop" : "Log in"}</h1>
      <p className="mt-1 text-sm text-stone-500">
        {mode === "signup" ? "Free. Takes a minute. Track expiry dates and rescue food before it's wasted." : "Welcome back."}
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {mode === "signup" && (
          <label className="block text-sm text-stone-600">
            Shop name
            <input className={input} required placeholder="e.g. Café Mogra" value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} />
          </label>
        )}
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
            minLength={mode === "signup" ? 8 : undefined}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          {mode === "signup" && <span className="text-xs text-stone-400">At least 8 characters</span>}
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
          {busy ? "Please wait…" : mode === "signup" ? "Create my shop" : "Log in"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-stone-500">
        {mode === "signup" ? (
          <>Already have an account? <Link href="/login" className="text-emerald-700 underline">Log in</Link></>
        ) : (
          <>New here? <Link href="/signup" className="text-emerald-700 underline">Set up your shop</Link></>
        )}
      </p>
    </div>
  );
}

export default function AuthForm({ mode }: { mode: Mode }) {
  return (
    <Suspense>
      <Form mode={mode} />
    </Suspense>
  );
}
